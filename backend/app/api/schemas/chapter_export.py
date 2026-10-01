"""章节导出 API 数据模型。"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class ChapterExportCreate(BaseModel):
    """创建章节导出任务。"""

    selected_volume_ids: list[str] = Field(default_factory=list)
    included_chapter_ids: list[str] = Field(default_factory=list)
    excluded_chapter_ids: list[str] = Field(default_factory=list)
    local_date: date
    # 导出格式：single 合并为一个 TXT；per_chapter 每章一个 TXT（按卷组织为文件夹）
    format: Literal["single", "per_chapter"] = "single"


class ChapterExportResponse(BaseModel):
    """章节导出任务状态。"""

    id: str
    status: str
    filename: str
    mode: str
    format: Literal["single", "per_chapter"] = "single"
    volume_count: int
    chapter_count: int
    word_count: int
    chapter_ids: list[str]
    current: int = 0
    total: int = 0
    stage: str | None = None
    chapter_title: str | None = None
    expires_at: datetime | None = None
    export_dir: str | None = None
    download_url: str | None = None
    error_message: str | None = None
