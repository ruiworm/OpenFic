# -*- coding: utf-8 -*-
"""Foreshadowing API Schemas - 伏笔请求/响应模型。"""

import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ForeshadowingCreateRequest(BaseModel):
    """创建伏笔请求。"""

    title: str = Field(..., max_length=200, description="伏笔标题/线索名称")
    description: str = Field(default="", description="伏笔描述/备忘")
    status: str = Field(
        default="planted",
        description="伏笔状态: planted (已埋设), developing (推进中), resolved (已回收), abandoned (已弃用)",
    )
    importance: str = Field(
        default="major",
        description="重要程度: major (主线核心), minor (支线暗线), clue (细节彩蛋)",
    )
    planted_chapter_id: str | None = Field(default=None, description="首次埋设章节 ID")
    target_chapter_id: str | None = Field(default=None, description="预计回收章节或卷")
    resolved_chapter_id: str | None = Field(default=None, description="实际回收章节 ID")
    character_ids: list[str] = Field(default_factory=list, description="关联角色 ID 列表")
    notes: str = Field(default="", description="跟进备注")


class ForeshadowingUpdateRequest(BaseModel):
    """更新伏笔请求。"""

    title: str | None = Field(default=None, max_length=200, description="伏笔标题/线索名称")
    description: str | None = Field(default=None, description="伏笔描述/备忘")
    status: str | None = Field(
        default=None,
        description="伏笔状态: planted (已埋设), developing (推进中), resolved (已回收), abandoned (已弃用)",
    )
    importance: str | None = Field(
        default=None,
        description="重要程度: major (主线核心), minor (支线暗线), clue (细节彩蛋)",
    )
    planted_chapter_id: str | None = Field(default=None, description="首次埋设章节 ID")
    target_chapter_id: str | None = Field(default=None, description="预计回收章节或卷")
    resolved_chapter_id: str | None = Field(default=None, description="实际回收章节 ID")
    character_ids: list[str] | None = Field(default=None, description="关联角色 ID 列表")
    notes: str | None = Field(default=None, description="跟进备注")


class ForeshadowingResponse(BaseModel):
    """伏笔响应。"""

    id: str = Field(description="伏笔 ID")
    project_id: str = Field(description="所属项目 ID")
    title: str = Field(description="伏笔标题/线索名称")
    description: str = Field(description="伏笔描述/备忘")
    status: str = Field(description="伏笔状态")
    importance: str = Field(description="重要程度")
    planted_chapter_id: str | None = Field(description="首次埋设章节 ID")
    target_chapter_id: str | None = Field(description="预计回收章节或卷")
    resolved_chapter_id: str | None = Field(description="实际回收章节 ID")
    character_ids: list[str] = Field(description="关联角色 ID 列表")
    notes: str = Field(description="跟进备注")
    created_at: datetime = Field(description="创建时间")
    updated_at: datetime = Field(description="更新时间")

    @classmethod
    def from_orm_model(cls, model: Any) -> "ForeshadowingResponse":
        try:
            chars = json.loads(model.character_ids) if model.character_ids else []
        except Exception:
            chars = []
        return cls(
            id=model.id,
            project_id=model.project_id,
            title=model.title,
            description=model.description,
            status=model.status,
            importance=model.importance,
            planted_chapter_id=model.planted_chapter_id,
            target_chapter_id=model.target_chapter_id,
            resolved_chapter_id=model.resolved_chapter_id,
            character_ids=chars if isinstance(chars, list) else [],
            notes=model.notes,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class ForeshadowingListResponse(BaseModel):
    """伏笔列表响应。"""

    items: list[ForeshadowingResponse] = Field(description="伏笔列表")
    total: int = Field(description="总数")
