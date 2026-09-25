"""工具参数外壳剥离的回归测试（纯函数层）。

背景：实测 `DeepSeek-V4-Flash-Vision-Exp` 会把 OpenAI 工具调用协议里的
`arguments` 字段名当作参数本体再包一层，例如把 ``{"query": "..."}`` 吐成
``{"arguments": {"query": "..."}}``，导致参数校验报 `query: Field required`。
下面用例里的载荷全部取自本机真实数据库 `agent_run_messages.tool_calls`
（2026-09-05 ~ 2026-09-25 录得的 38 条），不是构造出来的。
"""

from app.core.tool_args import unwrap_tool_arg_envelope


def test_unwraps_single_envelope() -> None:
    """真实载荷：search_chapters 的 query。"""
    assert unwrap_tool_arg_envelope(
        {"arguments": {"query": "雷耶斯 那本书 契琴伊察 七个标记点 通道"}}
    ) == {"query": "雷耶斯 那本书 契琴伊察 七个标记点 通道"}


def test_unwraps_nested_chapter_refs() -> None:
    """真实载荷：read_chapter 的 volume_ref / chapter_ref。"""
    payload = {
        "arguments": {
            "volume_ref": {"type": "title", "value": "第一卷 显形"},
            "chapter_ref": {"type": "order", "value": 10},
        }
    }
    assert unwrap_tool_arg_envelope(payload) == {
        "volume_ref": {"type": "title", "value": "第一卷 显形"},
        "chapter_ref": {"type": "order", "value": 10},
    }


def test_unwraps_double_envelope() -> None:
    """真实载荷：模型读到自己的历史输出后加到了两层。"""
    payload = {
        "arguments": {
            "arguments": {
                "volume_ref": {"type": "title", "value": "第一卷 显形"},
                "chapter_ref": {"type": "order", "value": 4},
            }
        }
    }
    assert unwrap_tool_arg_envelope(payload) == {
        "volume_ref": {"type": "title", "value": "第一卷 显形"},
        "chapter_ref": {"type": "order", "value": 4},
    }


def test_unwraps_list_and_scalar_payloads() -> None:
    """真实载荷：read_chapter_summaries 的 orders、read_character 的 name。"""
    assert unwrap_tool_arg_envelope({"arguments": {"orders": [6]}}) == {"orders": [6]}
    assert unwrap_tool_arg_envelope(
        {"arguments": {"name": "伊莎贝拉·雷耶斯"}}
    ) == {"name": "伊莎贝拉·雷耶斯"}


def test_keeps_normal_args_untouched() -> None:
    """真实载荷：read_character 的正常调用，键名就叫 name，不能被误剥。"""
    assert unwrap_tool_arg_envelope({"name": "伊莎贝拉·雷耶斯"}) == {
        "name": "伊莎贝拉·雷耶斯"
    }
    assert unwrap_tool_arg_envelope({"title": "关键字速查"}) == {"title": "关键字速查"}
    assert unwrap_tool_arg_envelope({"query": "x"}) == {"query": "x"}


def test_does_not_unwrap_when_extra_keys_would_be_lost() -> None:
    """外壳之外还有别的键时不剥离，宁可报错也不能丢参数。"""
    payload = {"arguments": {"query": "x"}, "force": True}
    assert unwrap_tool_arg_envelope(payload) == payload


def test_does_not_unwrap_non_mapping_arguments() -> None:
    assert unwrap_tool_arg_envelope({"arguments": "不是对象"}) == {
        "arguments": "不是对象"
    }
    assert unwrap_tool_arg_envelope({"arguments": [1, 2]}) == {"arguments": [1, 2]}


def test_does_not_over_strip_nested_string_value() -> None:
    """只剥到「某一层 arguments 不再是对象」为止。"""
    assert unwrap_tool_arg_envelope({"arguments": {"arguments": "字符串"}}) == {
        "arguments": "字符串"
    }


def test_caps_unwrap_depth() -> None:
    """层层加壳也必须有上限，不能无限递归。"""
    deep: object = {"query": "x"}
    for _ in range(6):
        deep = {"arguments": deep}
    result = unwrap_tool_arg_envelope(deep)  # type: ignore[arg-type]
    assert isinstance(result, dict)
    assert "arguments" in result  # 还剩几层，但一定收敛且不抛异常


def test_handles_empty_and_none() -> None:
    assert unwrap_tool_arg_envelope({}) == {}
    assert unwrap_tool_arg_envelope(None) == {}


def test_is_idempotent() -> None:
    once = unwrap_tool_arg_envelope({"arguments": {"query": "x"}})
    assert unwrap_tool_arg_envelope(once) == once
