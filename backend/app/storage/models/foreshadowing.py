# -*- coding: utf-8 -*-
"""Foreshadowing 数据模型。"""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel

from app.core.ids import generate_id


class Foreshadowing(SQLModel, table=True):
    """项目伏笔与线索模型。"""

    __tablename__ = "foreshadowings"

    id: str = Field(default_factory=generate_id, primary_key=True)
    project_id: str = Field(index=True, foreign_key="projects.id")
    title: str = Field(max_length=200)
    description: str = Field(default="")
    # 状态: planted (已埋下/待回收), developing (推进中), resolved (已回收), abandoned (已弃用)
    status: str = Field(default="planted", index=True, max_length=50)
    # 重要程度: major (主线核心), minor (支线暗线), clue (细节彩蛋)
    importance: str = Field(default="major", index=True, max_length=50)
    planted_chapter_id: str | None = Field(default=None, index=True, foreign_key="chapters.id")
    target_chapter_id: str | None = Field(default=None, max_length=100)
    resolved_chapter_id: str | None = Field(default=None, index=True, foreign_key="chapters.id")
    # JSON 序列化的关联角色 ID 列表，例如 '["char_1", "char_2"]'
    character_ids: str = Field(default="[]")
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
