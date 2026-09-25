"""工具参数外壳剥离在三个接入点上的端到端回归。

覆盖：
1. ``tool_call_recovery.recover_message_tool_calls`` —— agent 工具调用的唯一归一化入口
2. ``persistence.loader._tool_calls`` —— 历史回放（只在内存清洗，不改库）
3. ``LLMClient._normalize_tool_args`` —— 摘要等旁路调用

载荷取自本机真实录得的模型返回，见 ``tests/core/test_tool_args.py`` 的说明。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.agent_runtime.tool_call_recovery import (
    MALFORMED_TOOL_CALL_MARKER,
    parse_tool_args,
    recover_message_tool_calls,
)
from app.agent_runtime.persistence.loader import _tool_calls
from app.models.clients.llm_client import LLMClient


@dataclass
class _FakeMessage:
    """只暴露 recover_message_tool_calls 需要的两个属性。"""

    tool_calls: list[dict[str, Any]] | None = None
    invalid_tool_calls: list[dict[str, Any]] | None = None


def test_recover_unwraps_envelope_from_parsed_tool_calls() -> None:
    message = _FakeMessage(
        tool_calls=[
            {
                "id": "call_1",
                "name": "read_chapter",
                "args": {
                    "arguments": {
                        "volume_ref": {"type": "title", "value": "第一卷 显形"},
                        "chapter_ref": {"type": "order", "value": 10},
                    }
                },
            },
            {"id": "call_2", "name": "read_characters", "args": {}},
        ]
    )
    recovered = recover_message_tool_calls(message)
    assert recovered[0]["args"] == {
        "volume_ref": {"type": "title", "value": "第一卷 显形"},
        "chapter_ref": {"type": "order", "value": 10},
    }
    assert recovered[1]["args"] == {}


def test_recover_unwraps_envelope_from_raw_string_args() -> None:
    """模型把参数吐成字符串时的分支。"""
    message = _FakeMessage(
        invalid_tool_calls=[
            {
                "id": "call_1",
                "name": "search_chapters",
                "args": '{"arguments": {"query": "契琴伊察 通道"}}',
            }
        ]
    )
    recovered = recover_message_tool_calls(message)
    assert recovered[0]["args"] == {"query": "契琴伊察 通道"}


def test_recover_keeps_malformed_marker_for_truly_broken_json() -> None:
    """坏 JSON 仍走既有的 malformed 通道，不能被归一化掩盖。"""
    message = _FakeMessage(
        invalid_tool_calls=[{"id": "call_1", "name": "read_chapter", "args": "{不合法"}]
    )
    recovered = recover_message_tool_calls(message)
    assert recovered[0]["args"][MALFORMED_TOOL_CALL_MARKER] is True


def test_parse_tool_args_handles_both_forms() -> None:
    assert parse_tool_args({"arguments": {"query": "x"}}) == {"query": "x"}
    assert parse_tool_args('{"arguments": {"query": "x"}}') == {"query": "x"}
    assert parse_tool_args('{"query": "x"}') == {"query": "x"}
    assert parse_tool_args(None) == {}
    assert parse_tool_args("") == {}


def test_loader_replay_strips_envelope_without_touching_other_fields() -> None:
    """历史回放：args 被清洗，id/name 原样保留，且不抛异常。"""

    @dataclass
    class _Row:
        id: str
        tool_calls: str

    row = _Row(
        id="msg_1",
        tool_calls=(
            '[{"id": "call_1", "name": "read_chapter", "args": '
            '{"arguments": {"volume_ref": {"type": "title", "value": "第一卷 显形"},'
            ' "chapter_ref": {"type": "order", "value": 4}}}}]'
        ),
    )
    parsed = _tool_calls(row)  # type: ignore[arg-type]
    assert parsed is not None
    assert parsed[0]["id"] == "call_1"
    assert parsed[0]["name"] == "read_chapter"
    assert parsed[0]["args"] == {
        "volume_ref": {"type": "title", "value": "第一卷 显形"},
        "chapter_ref": {"type": "order", "value": 4},
    }


def test_loader_replay_returns_none_on_broken_json() -> None:
    """回归：坏 JSON 依旧降级为 None，不中断历史加载。"""

    @dataclass
    class _Row:
        id: str
        tool_calls: str

    assert _tool_calls(_Row(id="msg_1", tool_calls="{不是 JSON")) is None  # type: ignore[arg-type]


def test_llm_client_normalize_strips_envelope() -> None:
    assert LLMClient._normalize_tool_args({"arguments": {"orders": [6]}}) == {
        "orders": [6]
    }
    assert LLMClient._normalize_tool_args('{"arguments": {"query": "x"}}') == {
        "query": "x"
    }
    assert LLMClient._normalize_tool_args({"query": "x"}) == {"query": "x"}
    assert LLMClient._normalize_tool_args(None) == {}


def test_llm_client_normalize_still_repairs_raw_payload() -> None:
    """既有的 `_raw` 修补路径不能因为本次改动失效。"""
    assert LLMClient._normalize_tool_args({"_raw": '{"query": "x"}'}) == {"query": "x"}
