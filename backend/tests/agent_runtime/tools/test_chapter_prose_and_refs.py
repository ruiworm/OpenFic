"""写入侧空行折叠 + 章节定位失败提示的回归测试。

对应两个线上问题：
1. 模型写正文时按 Markdown 习惯产出段间空行（``\\n\\n``），全链路原本没有兜底；
2. 章节定位失败只抛 ``未找到章节: order=51``，既没说作用域也没给合法范围，
   模型无法自纠（标题编号与卷内 order 可能早已脱节）。
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
    chapter_count: int = 2,
):
    volume = MagicMock()
    volume.id = volume_id
    volume.project_id = "proj-1"
    volume.order = order
    volume.title = title
    volume.description = None
    volume.chapter_count = chapter_count
    return volume


def _make_chapter(
    *,
    order: int = 1,
    title: str = "第一章",
    content: str = "内容测试",
    word_count: int = 4,
    chapter_id: str = "chap-1",
    volume_id: str = "vol-1",
):
    chapter = MagicMock()
    chapter.id = chapter_id
    chapter.order = order
    chapter.title = title
    chapter.content = content
    chapter.word_count = word_count
    chapter.project_id = "proj-1"
    chapter.volume_id = volume_id
    chapter.created_at = None
    chapter.updated_at = None
    return chapter


# --------------------------------------------------------------------------
# A. 写入侧折叠：write_chapter
# --------------------------------------------------------------------------


async def test_write_chapter_collapses_blank_lines_before_persisting() -> None:
    from app.agent_runtime.tools.impls.chapter.write_chapter import WriteChapterTool

    volume = _make_volume(chapter_count=3)
    tool = WriteChapterTool(_state=_make_state())
    messy = "甲段\n\n乙段\n\n\n丙段"

    async def create_chapter(_session, chapter):
        chapter.id = "chap-new"
        return chapter

    with patch(
        "app.agent_runtime.tools.impls.chapter.write_chapter.create_session"
    ) as mock_cs, patch(
        "app.agent_runtime.tools.impls.chapter.write_chapter.volume_repo.list_by_project",
        AsyncMock(return_value=[volume]),
    ), patch(
        "app.agent_runtime.tools.impls.chapter.write_chapter.chapter_repo"
    ) as mock_repo, patch(
        "app.agent_runtime.tools.impls.chapter.write_chapter.record_chapter_diffs",
        AsyncMock(return_value=[]),
    ), patch(
        "app.agent_runtime.tools.impls.chapter.write_chapter.record_agent_activity_for_change",
        AsyncMock(),
    ), patch(
        "app.agent_runtime.tools.impls.chapter.write_chapter.refresh_volume_chapter_count",
        AsyncMock(),
    ), patch(
        "app.agent_runtime.tools.impls.chapter.write_chapter.refresh_project_stats",
        AsyncMock(),
    ), patch(
        "app.retrieval.chapter_index.safe_maybe_enqueue_auto_index", AsyncMock()
    ), patch(
        "app.retrieval.index_status.schedule_emit_index_status", lambda *_a, **_k: None
    ), patch(
        "app.background.jobs.service.commit_and_notify", AsyncMock()
    ):
        mock_cs.return_value = AsyncMock()
        mock_repo.get_max_order = AsyncMock(return_value=3)
        mock_repo.create = AsyncMock(side_effect=create_chapter)

        result = await tool.ainvoke(
            {
                "volume_ref": {"type": "order", "value": 1},
                "title": "新章节",
                "content": messy,
            }
        )

    persisted = mock_repo.create.call_args[0][1]
    assert persisted.content == "甲段\n乙段\n丙段"
    assert "\n\n" not in persisted.content
    assert json.loads(result)["success"] is True


# --------------------------------------------------------------------------
# A. 写入侧折叠：edit_chapter
# --------------------------------------------------------------------------


async def test_edit_chapter_collapses_blank_lines_after_replacement() -> None:
    from app.agent_runtime.tools.impls.chapter.edit_chapter import EditChapterTool

    volume = _make_volume()
    chapter = _make_chapter(content="甲段\n\n乙段\n\n丙段", word_count=6)
    tool = EditChapterTool(_state=_make_state())

    with patch(
        "app.agent_runtime.tools.impls.chapter.edit_chapter.create_session"
    ) as mock_cs, patch(
        "app.agent_runtime.tools.impls.chapter.edit_chapter.volume_repo.list_by_project",
        AsyncMock(return_value=[volume]),
    ), patch(
        "app.agent_runtime.tools.impls.chapter.edit_chapter.chapter_repo.get_by_volume_ref",
        AsyncMock(return_value=chapter),
    ), patch(
        "app.agent_runtime.tools.impls.chapter.edit_chapter.chapter_repo.update_chapter",
        AsyncMock(),
    ) as update_chapter, patch(
        "app.agent_runtime.tools.impls.chapter.edit_chapter.record_chapter_diffs",
        AsyncMock(return_value=[]),
    ), patch(
        "app.agent_runtime.tools.impls.chapter.edit_chapter.record_agent_activity_for_change",
        AsyncMock(),
    ), patch(
        "app.agent_runtime.tools.impls.chapter.edit_chapter.refresh_project_stats",
        AsyncMock(),
    ), patch(
        "app.retrieval.chapter_index.safe_maybe_enqueue_auto_index", AsyncMock()
    ), patch(
        "app.retrieval.index_status.schedule_emit_index_status", lambda *_a, **_k: None
    ), patch(
        "app.background.jobs.service.commit_and_notify", AsyncMock()
    ):
        mock_cs.return_value = AsyncMock()
        await tool.ainvoke(
            {
                "volume_ref": {"type": "order", "value": 1},
                "chapter_ref": {"type": "order", "value": 1},
                "old_content": "乙段",
                "new_content": "乙段改\n\n丁段",
            }
        )

    persisted = update_chapter.call_args[0][1]
    assert persisted.content == "甲段\n乙段改\n丁段\n丙段"
    assert "\n\n" not in persisted.content


# --------------------------------------------------------------------------
# C. 章节/卷定位失败提示
# --------------------------------------------------------------------------


def test_volume_not_found_lists_available_volumes() -> None:
    from app.agent_runtime.tools.impls.chapter.refs import (
        VolumeRef,
        resolve_volume_from_list,
    )

    volumes = [
        _make_volume(order=1, title="第一卷"),
        _make_volume(volume_id="vol-2", order=2, title="第二卷"),
    ]

    with pytest.raises(ToolExecutionError) as exc_info:
        resolve_volume_from_list(volumes, VolumeRef(type="order", value=9))

    message = str(exc_info.value)
    assert "未找到卷: order=9" in message
    assert "共 2 卷" in message
    assert "1=第一卷" in message
    assert "2=第二卷" in message


def test_volume_not_found_without_candidates_keeps_plain_message() -> None:
    from app.agent_runtime.tools.impls.chapter.refs import (
        VolumeRef,
        resolve_volume_from_list,
    )

    with pytest.raises(ToolExecutionError) as exc_info:
        resolve_volume_from_list([], VolumeRef(type="order", value=9))

    assert str(exc_info.value) == "未找到卷: order=9"


async def test_chapter_not_found_error_reports_volume_scope() -> None:
    from app.agent_runtime.tools.impls.chapter.refs import (
        ChapterRef,
        chapter_not_found_error,
    )

    metadata = [
        _make_chapter(order=1, title="第一章", chapter_id="c1"),
        _make_chapter(order=2, title="第七章", chapter_id="c2"),
    ]

    with patch(
        "app.storage.repos.chapter_repo.list_metadata_by_volume",
        AsyncMock(return_value=metadata),
    ):
        error = await chapter_not_found_error(
            AsyncMock(),
            volume_id="vol-1",
            ref=ChapterRef(type="order", value=51),
            volume_title="第一卷",
        )

    message = str(error)
    assert "未找到章节: order=51" in message
    assert "卷「第一卷」共 2 章" in message
    assert "order 为 1..2" in message
    # 标题编号与卷内 order 脱节是最容易踩的坑，提示里必须点明
    assert "可能与章节标题里的编号不一致" in message


async def test_chapter_not_found_error_handles_empty_volume() -> None:
    from app.agent_runtime.tools.impls.chapter.refs import (
        ChapterRef,
        chapter_not_found_error,
    )

    with patch(
        "app.storage.repos.chapter_repo.list_metadata_by_volume",
        AsyncMock(return_value=[]),
    ), patch(
        # 卷信息取不到时不做"同名卷"提示，保持原有文案
        "app.storage.repos.volume_repo.get_by_id",
        AsyncMock(return_value=None),
    ):
        error = await chapter_not_found_error(
            AsyncMock(),
            volume_id="vol-1",
            ref=ChapterRef(type="title", value="不存在的章节"),
            volume_title="第一卷",
        )

    message = str(error)
    assert "未找到章节: title=不存在的章节" in message
    assert "没有任何章节" in message
    assert "write_chapter" in message
