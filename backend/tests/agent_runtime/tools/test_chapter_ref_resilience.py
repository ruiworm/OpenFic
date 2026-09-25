"""章节定位的三条抗错加固（真实故障驱动）。

对应本机实测的故障链：
1. 项目里既有空占位卷「第一卷」又有真卷「第一卷 显形」，模型按 order 命中前者，
   只拿到「没有任何章节，可改用 write_chapter 新建」——**这句会把模型引向
   往空占位卷里新建章节**；
2. order=12 合法却静默命中「第六章 库库尔坎」（删章后 order 前移、标题未重编号），
   模型会把第六章当成第十二章直接总结，全程零信号；
3. 用户常说「第十二章」，而标题定位是精确匹配 ⇒ 直接「未找到」。
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agent_runtime.tools.errors import ToolExecutionError


def _make_state() -> dict:
    return {
        "session_id": "sess-1",
        "task_id": "task-1",
        "project_id": "proj-1",
        "model_config": {},
        "active_agent": None,
        "is_completed": False,
        "error": None,
        "retry_count": 0,
        "message_checkpoints": [],
        "user_request": "",
        "current_revision_id": "rev-1",
    }


def _make_volume(
    *,
    volume_id: str = "vol-1",
    order: int = 1,
    title: str = "第一卷",
    project_id: str = "proj-1",
):
    volume = MagicMock()
    volume.id = volume_id
    volume.project_id = project_id
    volume.order = order
    volume.title = title
    return volume


def _make_chapter(
    *,
    order: int = 1,
    title: str = "第一章 测控大厅",
    chapter_id: str = "chap-1",
    volume_id: str = "vol-1",
):
    chapter = MagicMock()
    chapter.id = chapter_id
    chapter.order = order
    chapter.title = title
    chapter.content = "正文首行\n正文次行"
    chapter.word_count = 12
    chapter.project_id = "proj-1"
    chapter.volume_id = volume_id
    return chapter


class _FakeResult:
    """模拟 SQLAlchemy 结果对象，只需要被仓库层用到的那两个方法。"""

    def __init__(self, one=None, many=None):
        self._one = one
        self._many = many or []

    def scalar_one_or_none(self):
        return self._one

    def scalars(self):
        return self

    def all(self):
        return self._many


def _fake_session(results: list[_FakeResult]) -> MagicMock:
    session = MagicMock()
    session.execute = AsyncMock(side_effect=results)
    return session


# --------------------------------------------------------------------------
# 0. 标题编号解析
# --------------------------------------------------------------------------


def test_parse_title_chapter_number() -> None:
    from app.agent_runtime.tools.impls.chapter.refs import parse_title_chapter_number

    assert parse_title_chapter_number("第一章 测控大厅") == 1
    assert parse_title_chapter_number("第十二章 同一个梦") == 12
    assert parse_title_chapter_number("第二十章 凶手自首") == 20
    assert parse_title_chapter_number("第三十八章 夜逃") == 38
    assert parse_title_chapter_number("第一百二十三章 归零") == 123
    assert parse_title_chapter_number(" 第十回 山门") == 10
    assert parse_title_chapter_number("第12章 用阿拉伯数字") == 12
    assert parse_title_chapter_number("第六章") == 6
    # 取不到编号时必须返回 None，不能瞎猜
    assert parse_title_chapter_number("楔子") is None
    assert parse_title_chapter_number("") is None
    assert parse_title_chapter_number("陆远在第三章里说过这句话") is None


# --------------------------------------------------------------------------
# 1. 空卷提示要指向「标题相近且有内容」的兄弟卷
# --------------------------------------------------------------------------


async def test_empty_volume_hint_points_to_similar_volume() -> None:
    from app.agent_runtime.tools.impls.chapter.refs import chapter_scope_hint

    placeholder = _make_volume(volume_id="vol-1", order=1, title="第一卷")
    real = _make_volume(volume_id="vol-2", order=2, title="第一卷 显形")
    real_chapters = [
        _make_chapter(order=1, chapter_id="c1"),
        _make_chapter(order=2, chapter_id="c2", title="第二章 古井"),
    ]

    async def metadata(_session, volume_id):
        return real_chapters if volume_id == "vol-2" else []

    with patch(
        "app.storage.repos.chapter_repo.list_metadata_by_volume",
        AsyncMock(side_effect=metadata),
    ), patch(
        "app.storage.repos.volume_repo.get_by_id",
        AsyncMock(return_value=placeholder),
    ), patch(
        "app.storage.repos.volume_repo.list_by_project",
        AsyncMock(return_value=[placeholder, real]),
    ):
        hint = await chapter_scope_hint(AsyncMock(), "vol-1", "第一卷")

    assert "卷「第一卷」下没有任何章节" in hint
    assert "第一卷 显形" in hint
    assert "order=2" in hint
    assert "共 2 章" in hint
    # 提示语本身也要读得通：别写成"标题相近的卷 卷「X」"
    assert "标题相近的卷：「第一卷 显形」" in hint
    # 必须给出可直接使用的 volume_ref，模型才能一步改对
    assert "'type': 'title', 'value': '第一卷 显形'" in hint


async def test_empty_volume_hint_skips_empty_siblings_and_unrelated_titles() -> None:
    from app.agent_runtime.tools.impls.chapter.refs import chapter_scope_hint

    placeholder = _make_volume(volume_id="vol-1", order=1, title="第一卷")
    also_empty = _make_volume(volume_id="vol-2", order=2, title="第一卷 显形")
    unrelated = _make_volume(volume_id="vol-3", order=3, title="第二卷 共振")

    with patch(
        "app.storage.repos.chapter_repo.list_metadata_by_volume",
        AsyncMock(return_value=[]),
    ), patch(
        "app.storage.repos.volume_repo.get_by_id",
        AsyncMock(return_value=placeholder),
    ), patch(
        "app.storage.repos.volume_repo.list_by_project",
        AsyncMock(return_value=[placeholder, also_empty, unrelated]),
    ):
        hint = await chapter_scope_hint(AsyncMock(), "vol-1", "第一卷")

    # 兄弟卷自身也是空的 ⇒ 不能拿它当"正确目标"误导模型
    assert "第一卷 显形" not in hint
    assert "第二卷 共振" not in hint
    assert "可用 list_chapters 确认" in hint
    assert "write_chapter" in hint


# --------------------------------------------------------------------------
# 2. 标题定位：精确 → 唯一前缀
# --------------------------------------------------------------------------


async def test_title_prefix_match_returns_unique_candidate() -> None:
    from app.storage.repos import chapter_repo

    chapter = _make_chapter(order=11, title="第十二章 同一个梦")
    session = _fake_session([_FakeResult(one=None), _FakeResult(many=[chapter])])

    match = await chapter_repo.get_by_volume_ref(
        session,
        "vol-1",
        ref_type="title",
        ref_value="第十二章",
        allow_title_prefix=True,
    )

    assert match is chapter


async def test_title_prefix_match_refuses_ambiguous_candidate() -> None:
    from app.storage.repos import chapter_repo

    session = _fake_session(
        [
            _FakeResult(one=None),
            _FakeResult(
                many=[
                    _make_chapter(order=1, title="第十章 倒计时"),
                    _make_chapter(order=2, title="第十一章 钥匙", chapter_id="c2"),
                ]
            ),
        ]
    )

    match = await chapter_repo.get_by_volume_ref(
        session,
        "vol-1",
        ref_type="title",
        ref_value="第十",
        allow_title_prefix=True,
    )

    # 多命中一律当作未找到，交给调用方列出候选，绝不猜一个
    assert match is None


async def test_title_prefix_disabled_by_default() -> None:
    from app.storage.repos import chapter_repo

    session = _fake_session([_FakeResult(one=None)])

    match = await chapter_repo.get_by_volume_ref(
        session, "vol-1", ref_type="title", ref_value="第十二章"
    )

    assert match is None
    # 只查了一次（精确），没有退化成前缀查询
    assert session.execute.await_count == 1


# --------------------------------------------------------------------------
# 3. order 与标题编号错位时的提示
# --------------------------------------------------------------------------


def _mismatched_volume_metadata() -> list:
    """真实数据快照：删掉第六章后 order 前移，补写的第六章被追加到卷末。"""
    titles = [
        "第一章 测控大厅",
        "第二章 古井",
        "第三章 时间表",
        "第四章 拓片",
        "第五章 会议桌",
        "第七章 种子",
        "第八章 月面",
        "第九章 空腔",
        "第十章 倒计时",
        "第十一章 钥匙嵌入石台",
        "第十二章 同一个梦",
        "第六章 库库尔坎",
    ]
    return [
        _make_chapter(order=index, title=title, chapter_id=f"c{index}")
        for index, title in enumerate(titles, start=1)
    ]


async def test_order_title_mismatch_notice_flags_internal_inconsistency() -> None:
    from app.agent_runtime.tools.impls.chapter.refs import (
        order_title_mismatch_notice,
    )

    metadata = _mismatched_volume_metadata()
    with patch(
        "app.storage.repos.chapter_repo.list_metadata_by_volume",
        AsyncMock(return_value=metadata),
    ):
        notice = await order_title_mismatch_notice(
            AsyncMock(), volume_id="vol-1", chapter=metadata[11]
        )

    assert notice is not None
    assert "order=12" in notice
    assert "第六章 库库尔坎" in notice
    # 关键：要直接告诉模型"你要的第十二章在哪"
    assert "标题编号为 12 的章节在 order=11" in notice
    assert "'type': 'title', 'value': '第六章 库库尔坎'" in notice


async def test_order_title_mismatch_notice_silent_when_offsets_are_consistent() -> None:
    """第二卷标题从第十三章起连续编号属正常，不能每次读取都塞提示。"""
    from app.agent_runtime.tools.impls.chapter.refs import (
        order_title_mismatch_notice,
    )

    metadata = [
        _make_chapter(order=1, title="第十三章 抵岸", chapter_id="c1"),
        _make_chapter(order=2, title="第十四章 共振", chapter_id="c2"),
    ]
    with patch(
        "app.storage.repos.chapter_repo.list_metadata_by_volume",
        AsyncMock(return_value=metadata),
    ):
        notice = await order_title_mismatch_notice(
            AsyncMock(), volume_id="vol-1", chapter=metadata[0]
        )

    assert notice is None


async def test_order_title_mismatch_notice_silent_when_number_matches_order() -> None:
    from app.agent_runtime.tools.impls.chapter.refs import (
        order_title_mismatch_notice,
    )

    metadata = _mismatched_volume_metadata()
    notice = await order_title_mismatch_notice(
        AsyncMock(), volume_id="vol-1", chapter=metadata[0]
    )

    assert notice is None


# --------------------------------------------------------------------------
# 4. read_chapter 端到端：前缀定位 + 提示字段
# --------------------------------------------------------------------------


async def test_read_chapter_by_title_prefix_returns_content_without_notice() -> None:
    from app.agent_runtime.tools.impls.chapter.read_chapter import ReadChapterTool

    volume = _make_volume(volume_id="vol-1", order=2, title="第一卷 显形")
    chapter = _make_chapter(order=11, title="第十二章 同一个梦")
    metadata = _mismatched_volume_metadata()
    tool = ReadChapterTool(_state=_make_state())

    with patch(
        "app.agent_runtime.tools.impls.chapter.read_chapter.create_session"
    ) as mock_cs, patch(
        "app.agent_runtime.tools.impls.chapter.read_chapter.volume_repo.list_by_project",
        AsyncMock(return_value=[volume]),
    ), patch(
        "app.agent_runtime.tools.impls.chapter.read_chapter.chapter_repo.get_by_volume_ref",
        AsyncMock(return_value=chapter),
    ) as get_ref, patch(
        "app.storage.repos.chapter_repo.list_metadata_by_volume",
        AsyncMock(return_value=metadata),
    ):
        mock_cs.return_value = AsyncMock()
        result = await tool.ainvoke(
            {
                "volume_ref": {"type": "title", "value": "第一卷 显形"},
                "chapter_ref": {"type": "title", "value": "第十二章"},
            }
        )

    payload = json.loads(result)
    assert payload["title"] == "第十二章 同一个梦"
    assert payload["content"].startswith("1|正文首行")
    # 只读入口必须放开前缀匹配，否则用户说「第十二章」会直接未找到
    assert get_ref.await_args.kwargs["allow_title_prefix"] is True
    # 按标题定位时不该塞 order 错位提示
    assert "notice" not in payload


async def test_read_chapter_by_order_carries_mismatch_notice() -> None:
    from app.agent_runtime.tools.impls.chapter.read_chapter import ReadChapterTool

    volume = _make_volume(volume_id="vol-1", order=2, title="第一卷 显形")
    chapter = _make_chapter(order=12, title="第六章 库库尔坎")
    metadata = _mismatched_volume_metadata()
    tool = ReadChapterTool(_state=_make_state())

    with patch(
        "app.agent_runtime.tools.impls.chapter.read_chapter.create_session"
    ) as mock_cs, patch(
        "app.agent_runtime.tools.impls.chapter.read_chapter.volume_repo.list_by_project",
        AsyncMock(return_value=[volume]),
    ), patch(
        "app.agent_runtime.tools.impls.chapter.read_chapter.chapter_repo.get_by_volume_ref",
        AsyncMock(return_value=chapter),
    ), patch(
        "app.storage.repos.chapter_repo.list_metadata_by_volume",
        AsyncMock(return_value=metadata),
    ):
        mock_cs.return_value = AsyncMock()
        result = await tool.ainvoke(
            {
                "volume_ref": {"type": "title", "value": "第一卷 显形"},
                "chapter_ref": {"type": "order", "value": 12},
            }
        )

    payload = json.loads(result)
    assert payload["title"] == "第六章 库库尔坎"
    assert "标题编号为 12 的章节在 order=11" in payload["notice"]


async def test_read_chapter_error_for_empty_volume_names_similar_volume() -> None:
    from app.agent_runtime.tools.impls.chapter.read_chapter import ReadChapterTool

    placeholder = _make_volume(volume_id="vol-1", order=1, title="第一卷")
    real = _make_volume(volume_id="vol-2", order=2, title="第一卷 显形")
    real_chapters = [
        _make_chapter(order=index, title=f"第{index}章") for index in range(1, 13)
    ]
    tool = ReadChapterTool(_state=_make_state())

    async def metadata(_session, volume_id):
        return real_chapters if volume_id == "vol-2" else []

    with patch(
        "app.agent_runtime.tools.impls.chapter.read_chapter.create_session"
    ) as mock_cs, patch(
        "app.agent_runtime.tools.impls.chapter.read_chapter.volume_repo.list_by_project",
        AsyncMock(return_value=[placeholder, real]),
    ), patch(
        "app.agent_runtime.tools.impls.chapter.read_chapter.chapter_repo.get_by_volume_ref",
        AsyncMock(return_value=None),
    ), patch(
        "app.storage.repos.chapter_repo.list_metadata_by_volume",
        AsyncMock(side_effect=metadata),
    ), patch(
        "app.storage.repos.volume_repo.get_by_id",
        AsyncMock(return_value=placeholder),
    ):
        mock_cs.return_value = AsyncMock()
        result = await tool.ainvoke(
            {
                "volume_ref": {"type": "order", "value": 1},
                "chapter_ref": {"type": "order", "value": 12},
            }
        )

    payload = json.loads(result)
    assert payload["success"] is False
    message = payload["message"]
    assert "卷「第一卷」下没有任何章节" in message
    assert "第一卷 显形" in message
    assert "共 12 章" in message


def test_volume_ref_helper_still_raises_tool_error() -> None:
    """回归：新增提示逻辑不能吞掉原有的 ToolExecutionError。"""
    from app.agent_runtime.tools.impls.chapter.refs import (
        VolumeRef,
        resolve_volume_from_list,
    )

    with pytest.raises(ToolExecutionError) as exc_info:
        resolve_volume_from_list([], VolumeRef(type="order", value=9))

    assert str(exc_info.value) == "未找到卷: order=9"
