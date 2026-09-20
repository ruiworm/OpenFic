# -*- coding: utf-8 -*-
"""伏笔 Agent 工具测试。"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.agent_runtime.tools.impls.context.foreshadowing import (
    ListForeshadowingsTool,
    RecordForeshadowingTool,
    ResolveForeshadowingTool,
)


def _make_state() -> dict:
    return {
        "session_id": "sess-1",
        "project_id": "proj-1",
        "model_config": {},
        "active_agent": "writer",
        "is_completed": False,
        "error": None,
        "retry_count": 0,
        "message_checkpoints": [],
        "user_request": "",
    }


@pytest.mark.asyncio
async def test_list_foreshadowings_tool() -> None:
    tool = ListForeshadowingsTool(_state=_make_state())
    mock_items = [
        SimpleNamespace(
            id="f1",
            title="黑石指环",
            description="遇魔发光",
            status="planted",
            importance="major",
            planted_chapter_id="c1",
            target_chapter_id=None,
            resolved_chapter_id=None,
            character_ids='["char_1"]',
            notes="备忘笔记",
        )
    ]

    with patch(
        "app.agent_runtime.tools.impls.context.foreshadowing.create_session"
    ) as mock_cs, patch(
        "app.agent_runtime.tools.impls.context.foreshadowing.foreshadowing_repo"
    ) as mock_repo:
        mock_session = AsyncMock()
        mock_cs.return_value = mock_session
        mock_repo.list_by_project = AsyncMock(return_value=(mock_items, 1))

        result = await tool.ainvoke({"status": "planted"})

    parsed = json.loads(result)
    assert "foreshadowings" in parsed
    assert len(parsed["foreshadowings"]) == 1
    assert parsed["foreshadowings"][0]["title"] == "黑石指环"
    assert parsed["foreshadowings"][0]["character_ids"] == ["char_1"]


@pytest.mark.asyncio
async def test_record_foreshadowing_tool() -> None:
    tool = RecordForeshadowingTool(_state=_make_state())
    mock_created = SimpleNamespace(
        id="f2",
        title="古剑残片",
        status="planted",
    )

    with patch(
        "app.agent_runtime.tools.impls.context.foreshadowing.create_session"
    ) as mock_cs, patch(
        "app.agent_runtime.tools.impls.context.foreshadowing.foreshadowing_repo"
    ) as mock_repo:
        mock_session = AsyncMock()
        mock_cs.return_value = mock_session
        mock_repo.create = AsyncMock(return_value=mock_created)

        result = await tool.ainvoke({
            "title": "古剑残片",
            "description": "第 5 章偶然拾得",
            "importance": "minor",
        })

    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["foreshadowing_id"] == "f2"
    assert parsed["title"] == "古剑残片"


@pytest.mark.asyncio
async def test_resolve_foreshadowing_tool() -> None:
    tool = ResolveForeshadowingTool(_state=_make_state())
    mock_existing = SimpleNamespace(
        id="f3",
        project_id="proj-1",
        title="神秘人字条",
        status="planted",
        notes="初次出现",
    )
    mock_updated = SimpleNamespace(
        id="f3",
        title="神秘人字条",
        status="resolved",
        resolved_chapter_id="chap_9",
    )

    with patch(
        "app.agent_runtime.tools.impls.context.foreshadowing.create_session"
    ) as mock_cs, patch(
        "app.agent_runtime.tools.impls.context.foreshadowing.foreshadowing_repo"
    ) as mock_repo:
        mock_session = AsyncMock()
        mock_cs.return_value = mock_session
        mock_repo.get_by_id = AsyncMock(return_value=mock_existing)
        mock_repo.update = AsyncMock(return_value=mock_updated)

        result = await tool.ainvoke({
            "foreshadowing_id": "f3",
            "resolved_chapter_id": "chap_9",
            "resolution_notes": "在第九章揭露作者正是师尊",
        })

    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["status"] == "resolved"
    assert parsed["resolved_chapter_id"] == "chap_9"
