# -*- coding: utf-8 -*-
"""Deconstruction 数据模型。"""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel

from app.core.ids import generate_id


class Deconstruction(SQLModel, table=True):
    """小说拆解分析报告模型。"""

    __tablename__ = "deconstructions"

    id: str = Field(default_factory=generate_id, primary_key=True)
    title: str = Field(default="小说深度拆解分析", max_length=200)
    source_title: str = Field(default="", max_length=200)
    source_preview: str = Field(default="")
    source_word_count: int = Field(default=0)
    source_text: str = Field(default="")
    model_id: str = Field(default="", max_length=100)
    prompt_template: str = Field(default="")
    report_markdown: str = Field(default="")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
