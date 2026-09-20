# -*- coding: utf-8 -*-
"""伏笔与线索管理 Agent 工具。"""

import json
from typing import Any
from pydantic import BaseModel, Field

from app.agent_runtime.tools.base import AgentTool
from app.agent_runtime.tools.errors import ToolExecutionError
from app.agent_runtime.tools.registry import ToolRegistry
from app.storage.database import create_session
from app.storage.models.foreshadowing import Foreshadowing
from app.storage.repos import foreshadowing_repo


class ListForeshadowingsInput(BaseModel):
    status: str | None = Field(
        default=None,
        description="按状态筛选: planted (已埋设/待回收), developing (推进中), resolved (已回收), abandoned (已弃用)。不传则返回所有状态。",
    )
    importance: str | None = Field(
        default=None,
        description="按重要程度筛选: major (主线核心), minor (支线暗线), clue (细节彩蛋)。",
    )


class RecordForeshadowingInput(BaseModel):
    title: str = Field(description="伏笔标题或核心线索简述，例如'黑石项链的暗红异光'")
    description: str = Field(default="", description="伏笔详细设定或剧情埋点说明")
    importance: str = Field(
        default="major",
        description="重要程度: major (主线核心), minor (支线暗线), clue (细节彩蛋)",
    )
    planted_chapter_id: str | None = Field(
        default=None,
        description="首次埋设伏笔的章节 ID（如已知）",
    )
    target_chapter_id: str | None = Field(
        default=None,
        description="预期回收或揭开伏笔的章节或卷（例如'第十章'或具体章节 ID）",
    )
    character_ids: list[str] = Field(
        default_factory=list,
        description="关联的角色 ID 列表",
    )
    notes: str = Field(default="", description="创作者备忘笔记")


class ResolveForeshadowingInput(BaseModel):
    foreshadowing_id: str = Field(description="要标记回收的伏笔 ID")
    resolved_chapter_id: str | None = Field(
        default=None,
        description="实际回收或收尾此伏笔的章节 ID",
    )
    resolution_notes: str | None = Field(
        default=None,
        description="回收说明或补充备注",
    )


@ToolRegistry.register
class ListForeshadowingsTool(AgentTool):
    """查询小说的伏笔与暗线列表。"""

    name: str = "list_foreshadowings"
    description: str = (
        "列出当前小说的伏笔与未回收线索列表。写作或审校前可调用此工具，掌握哪些暗线已埋设、待回收，避免遗漏填坑。"
    )
    access_level: str = "readonly"
    args_schema: type[BaseModel] = ListForeshadowingsInput

    async def _execute(
        self,
        status: str | None = None,
        importance: str | None = None,
    ) -> str:
        session = await create_session()
        try:
            items, _ = await foreshadowing_repo.list_by_project(
                session,
                self.project_id,
                status=status,
                importance=importance,
                page=1,
                page_size=100,
            )
            result = []
            for item in items:
                try:
                    c_ids = json.loads(item.character_ids) if item.character_ids else []
                except Exception:
                    c_ids = []
                result.append(
                    {
                        "id": item.id,
                        "title": item.title,
                        "description": item.description,
                        "status": item.status,
                        "importance": item.importance,
                        "planted_chapter_id": item.planted_chapter_id,
                        "target_chapter_id": item.target_chapter_id,
                        "resolved_chapter_id": item.resolved_chapter_id,
                        "character_ids": c_ids,
                        "notes": item.notes,
                    }
                )
            return json.dumps({"foreshadowings": result}, ensure_ascii=False)
        finally:
            await session.close()


@ToolRegistry.register
class RecordForeshadowingTool(AgentTool):
    """记录新的伏笔或暗线。"""

    name: str = "record_foreshadowing"
    description: str = (
        "为小说新建一个伏笔或剧情线索记录。在创作中埋入新线索或重要剧情伏笔时调用。"
    )
    access_level: str = "write"
    args_schema: type[BaseModel] = RecordForeshadowingInput

    async def _execute(
        self,
        title: str,
        description: str = "",
        importance: str = "major",
        planted_chapter_id: str | None = None,
        target_chapter_id: str | None = None,
        character_ids: list[str] | None = None,
        notes: str = "",
    ) -> str:
        session = await create_session()
        try:
            char_json = json.dumps(character_ids or [], ensure_ascii=False)
            foreshadowing = Foreshadowing(
                project_id=self.project_id,
                title=title,
                description=description,
                status="planted",
                importance=importance,
                planted_chapter_id=planted_chapter_id,
                target_chapter_id=target_chapter_id,
                character_ids=char_json,
                notes=notes,
            )
            created = await foreshadowing_repo.create(session, foreshadowing)
            await session.commit()
            return json.dumps(
                {
                    "success": True,
                    "foreshadowing_id": created.id,
                    "title": created.title,
                    "status": created.status,
                },
                ensure_ascii=False,
            )
        except Exception as e:
            await session.rollback()
            raise ToolExecutionError(f"创建伏笔失败: {e}") from e
        finally:
            await session.close()


@ToolRegistry.register
class ResolveForeshadowingTool(AgentTool):
    """回收或完结指定的伏笔。"""

    name: str = "resolve_foreshadowing"
    description: str = (
        "将指定的伏笔标记为已回收（resolved），并记录回收章节与收尾说明。"
    )
    access_level: str = "write"
    args_schema: type[BaseModel] = ResolveForeshadowingInput

    async def _execute(
        self,
        foreshadowing_id: str,
        resolved_chapter_id: str | None = None,
        resolution_notes: str | None = None,
    ) -> str:
        session = await create_session()
        try:
            foreshadowing = await foreshadowing_repo.get_by_id(session, foreshadowing_id)
            if not foreshadowing or foreshadowing.project_id != self.project_id:
                raise ToolExecutionError(f"未找到 ID 为 {foreshadowing_id} 的伏笔")

            update_data: dict[str, Any] = {"status": "resolved"}
            if resolved_chapter_id is not None:
                update_data["resolved_chapter_id"] = resolved_chapter_id
            if resolution_notes:
                prev_notes = (foreshadowing.notes or "").strip()
                new_notes = f"{prev_notes}\n[回收说明]: {resolution_notes}".strip()
                update_data["notes"] = new_notes

            updated = await foreshadowing_repo.update(session, foreshadowing_id, **update_data)
            await session.commit()
            return json.dumps(
                {
                    "success": True,
                    "foreshadowing_id": updated.id,
                    "title": updated.title,
                    "status": updated.status,
                    "resolved_chapter_id": updated.resolved_chapter_id,
                },
                ensure_ascii=False,
            )
        except Exception as e:
            await session.rollback()
            raise ToolExecutionError(f"回收伏笔失败: {e}") from e
        finally:
            await session.close()
