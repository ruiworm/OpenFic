# -*- coding: utf-8 -*-
"""Deconstruction API Schemas."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class DeconstructionStreamRequest(BaseModel):
    """发起拆书流式生成请求。"""

    text: str = Field(description="待拆解的小说正文/样章文本", min_length=1)
    model_id: str | None = Field(default=None, description="指定调用的模型 ID，未指定则使用系统默认模型")
    provider_id: str | None = Field(default=None, description="指定调用的提供商/API Key 连接 ID")
    prompt_template: str | None = Field(default=None, description="自定义拆书提示词模板，未指定则使用内置 22 维黄金分析师模板")
    title: str | None = Field(default=None, description="分析报告标题")
    source_title: str | None = Field(default=None, description="原书名或来源标签")


class DeconstructionCreateRequest(BaseModel):
    """手动保存拆书报告请求。"""

    title: str = Field(default="小说深度拆解分析", max_length=200)
    source_title: str = Field(default="", max_length=200)
    source_preview: str = Field(default="")
    source_word_count: int = Field(default=0)
    source_text: str = Field(default="")
    model_id: str = Field(default="")
    prompt_template: str = Field(default="")
    report_markdown: str = Field(description="生成的完整 Markdown 拆解报告")


class DeconstructionResponse(BaseModel):
    """拆书报告详情响应。"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    source_title: str
    source_preview: str
    source_word_count: int
    source_text: str
    model_id: str
    prompt_template: str
    report_markdown: str
    created_at: datetime
    updated_at: datetime


class DeconstructionListResponse(BaseModel):
    """拆书报告列表响应。"""

    items: list[DeconstructionResponse]
    total: int
    page: int
    page_size: int


class CreateProjectFromDeconstructionRequest(BaseModel):
    """根据拆书报告生成新书项目请求。"""

    title: str | None = Field(default=None, description="新小说项目名称，默认自动基于原书名生成")
    description: str | None = Field(default=None, description="项目简介，默认从拆解报告核心框架中提取")


class CreateProjectFromDeconstructionResponse(BaseModel):
    """生成新书响应。"""

    project_id: str
    title: str


class ExportToNoteRequest(BaseModel):
    """将拆书报告存入已有项目笔记请求。"""

    project_id: str = Field(description="目标小说项目 ID")


class ExportToNoteResponse(BaseModel):
    """存入笔记响应。"""

    note_id: str
    project_id: str
    title: str
