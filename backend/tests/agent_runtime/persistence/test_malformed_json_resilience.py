# -*- coding: utf-8 -*-
"""JSON 字段损坏时的容错测试。

背景：持久化数据中的 JSON 字段（tool_calls / message_metadata）若损坏，
旧实现在 ``json.loads`` 处直接抛 ``JSONDecodeError``；该异常经
``session_runner._handle_stream_failure`` 原样透传到前端，并且该会话
每次续聊（加载历史）都会再次失败。

以下测试锁定「坏数据降级、不抛异常、不瘫会话」的行为。
"""

import json

import pytest
from langchain_core.messages import AIMessage
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent_runtime.persistence import repo
from app.agent_runtime.persistence.loader import load_history

# 缺一个冒号 —— 与线上买家报错同源的最小复现
BROKEN_TOOL_CALLS = '[{"id": "call_1" "name": "read_chapter"}]'
BROKEN_METADATA = '{"revision_id" "abc"}'

# 模型属性名 → 实际列名（message_metadata 的列名是 metadata）
_COLUMN_BY_FIELD = {"tool_calls": "tool_calls", "message_metadata": "metadata"}


async def _corrupt(
    db_session: AsyncSession, message_id: str, *, column: str, value: str
) -> None:
    """绕过写入侧（写入永远是合法 JSON），直接改坏库里的字段。"""
    sql_column = _COLUMN_BY_FIELD[column]
    await db_session.execute(
        text(f"UPDATE agent_run_messages SET {sql_column} = :value WHERE id = :mid"),
        {"value": value, "mid": message_id},
    )
    await db_session.commit()


async def _seed(db_session: AsyncSession, task_id: str, project_id: str):
    assistant = await repo.insert_message(
        db_session,
        session_id="session_bad",
        task_id=task_id,
        project_id=project_id,
        role="assistant",
        content="准备读取章节",
        tool_calls=[{"id": "call_1", "name": "read_chapter", "args": {}}],
        status="complete",
    )
    await repo.insert_message(
        db_session,
        session_id="session_bad",
        task_id=task_id,
        project_id=project_id,
        role="tool",
        content="章节正文",
        tool_call_id="call_1",
        tool_name="read_chapter",
        status="complete",
    )
    return assistant


@pytest.mark.asyncio
async def test_load_history_survives_broken_tool_calls(
    db_session: AsyncSession, sample_task
):
    assistant = await _seed(db_session, sample_task.id, sample_task.project_id)
    await _corrupt(
        db_session, assistant.id, column="tool_calls", value=BROKEN_TOOL_CALLS
    )

    # 旧实现会在此抛 json.JSONDecodeError
    messages = await load_history(db_session, "session_bad")

    assistant_messages = [m for m in messages if isinstance(m, AIMessage)]
    assert len(assistant_messages) == 1
    # 坏 tool_calls 降级为空列表：模型看到一条普通的 assistant 消息
    assert assistant_messages[0].tool_calls == []
    assert assistant_messages[0].content == "准备读取章节"


@pytest.mark.asyncio
async def test_load_history_drops_orphan_tool_message(
    db_session: AsyncSession, sample_task
):
    """tool_calls 损坏后，对应 tool 消息必须被丢弃，否则会构成非法的历史结构。"""
    assistant = await _seed(db_session, sample_task.id, sample_task.project_id)
    await _corrupt(
        db_session, assistant.id, column="tool_calls", value=BROKEN_TOOL_CALLS
    )

    messages = await load_history(db_session, "session_bad")

    # AIMessage 的 type 是 "ai"
    assert [m.type for m in messages] == ["ai"]


@pytest.mark.asyncio
async def test_repo_row_to_dto_survives_broken_json(
    db_session: AsyncSession, sample_task
):
    assistant = await _seed(db_session, sample_task.id, sample_task.project_id)
    await _corrupt(
        db_session, assistant.id, column="tool_calls", value=BROKEN_TOOL_CALLS
    )
    await _corrupt(
        db_session, assistant.id, column="message_metadata", value=BROKEN_METADATA
    )

    # 旧实现会在此抛 json.JSONDecodeError
    messages = await repo.list_by_session(db_session, "session_bad")

    target = next(m for m in messages if m.id == assistant.id)
    assert target.tool_calls is None
    assert target.metadata == {}


@pytest.mark.asyncio
async def test_valid_json_still_parsed(db_session: AsyncSession, sample_task):
    """确保容错改造没有改变正常路径。"""
    await _seed(db_session, sample_task.id, sample_task.project_id)

    messages = await load_history(db_session, "session_bad")
    assistant = next(m for m in messages if isinstance(m, AIMessage))

    # langchain 规范化后会给每个 tool_call 补上 type 字段
    assert len(assistant.tool_calls) == 1
    assert assistant.tool_calls[0]["id"] == "call_1"
    assert assistant.tool_calls[0]["name"] == "read_chapter"
    assert assistant.tool_calls[0]["args"] == {}
    assert [m.type for m in messages] == ["ai", "tool"]


def test_safe_json_loads_semantics():
    from app.core.json_safe import safe_json_loads

    # 空值 → 默认值
    assert safe_json_loads(None, [], context="t") == []
    assert safe_json_loads("", {}, context="t") == {}
    # 合法 → 解析结果
    assert safe_json_loads('{"a": 1}', {}, context="t") == {"a": 1}
    assert safe_json_loads('[1, 2]', [], context="t") == [1, 2]
    # 损坏 → 默认值，不抛
    assert safe_json_loads(BROKEN_TOOL_CALLS, None, context="t", expected=list) is None
    # 类型不符 → 默认值
    assert safe_json_loads('{"a": 1}', [], context="t", expected=list) == []
    assert safe_json_loads('[1]', {}, context="t", expected=dict) == {}
    # 非字符串的合法结构直接透传
    assert safe_json_loads([{"a": 1}], [], context="t", expected=list) == [{"a": 1}]


def test_broken_payload_really_breaks_raw_json_loads():
    """锁定「这是真 bug」：原始 json.loads 确实会抛。"""
    with pytest.raises(json.JSONDecodeError):
        json.loads(BROKEN_TOOL_CALLS)
