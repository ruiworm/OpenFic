"""
网文大盘与扫榜系统数据模型 (Pydantic Schemas)
"""

from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class TrendDataPoint(BaseModel):
    date: str
    read_count: int
    in_read_count: Optional[int] = None
    rank: int

    @model_validator(mode="after")
    def populate_in_read(self) -> "TrendDataPoint":
        if self.in_read_count is None:
            self.in_read_count = self.read_count
        return self


class GenreMetric(BaseModel):
    name: str
    channel: str  # male / female
    total_read_count: int
    read_count_formatted: str
    growth_rate_7d: float
    growth_rate_30d: float
    daily_debut_count: int
    turnover_rate: float
    competition_level: str  # low, medium, high, intense
    is_blue_ocean: bool
    summary: str


class MarketOverviewResponse(BaseModel):
    total_market_read_count: int
    total_market_read_formatted: str
    top_growing_genre: GenreMetric
    most_competitive_genre: GenreMetric
    blue_ocean_genre: GenreMetric
    genres: List[GenreMetric]
    updated_at: str


class MarketBook(BaseModel):
    book_id: str
    id: Optional[str] = None
    title: str
    author: str
    channel: str  # male / female
    category: str
    tags: List[str] = Field(default_factory=list)
    cover_url: Optional[str] = None
    intro: str = ""
    word_count: int = 0
    debut_days: int = 0
    score: float = 9.0
    read_count: int = 0
    read_count_formatted: str = "0"
    gain_7d: int = 0
    gain_7d_formatted: str = "0"
    gain_30d: int = 0
    gain_30d_formatted: str = "0"
    growth_rate_7d: float = 0.0
    status: str = "surging"  # surging, stable, declining, fake_spike
    lifecycle_status: Optional[str] = None
    rank: int = 1
    platform: str = "番茄小说"
    delta_7d: Optional[int] = None
    delta_30d: Optional[int] = None
    in_read_count: Optional[int] = None
    is_debut: Optional[bool] = None

    @model_validator(mode="after")
    def populate_aliases(self) -> "MarketBook":
        if self.id is None:
            self.id = self.book_id
        if self.lifecycle_status is None:
            self.lifecycle_status = self.status
        if self.in_read_count is None:
            self.in_read_count = self.read_count
        if self.delta_7d is None:
            self.delta_7d = self.gain_7d
        if self.delta_30d is None:
            self.delta_30d = self.gain_30d
        if self.is_debut is None:
            self.is_debut = self.debut_days <= 7
        return self


class ChapterBrief(BaseModel):
    chapter_index: int
    chapter_num: Optional[int] = None
    title: str
    word_count: int
    content_preview: str
    content: str

    @model_validator(mode="after")
    def populate_chapter_num(self) -> "ChapterBrief":
        if self.chapter_num is None:
            self.chapter_num = self.chapter_index
        return self


class BookDetailResponse(MarketBook):
    history_trends_7d: List[TrendDataPoint] = Field(default_factory=list)
    history_trends_30d: List[TrendDataPoint] = Field(default_factory=list)
    trend_7d: List[TrendDataPoint] = Field(default_factory=list)
    trend_30d: List[TrendDataPoint] = Field(default_factory=list)
    author_works: List[dict] = Field(default_factory=list)
    sample_chapters: List[ChapterBrief] = Field(default_factory=list)

    @model_validator(mode="after")
    def populate_trends(self) -> "BookDetailResponse":
        if not self.trend_7d and self.history_trends_7d:
            self.trend_7d = self.history_trends_7d
        if not self.trend_30d and self.history_trends_30d:
            self.trend_30d = self.history_trends_30d
        return self


class MarketRankResponse(BaseModel):
    items: List[MarketBook]
    total: int
    page: int
    page_size: int
    channels: List[str]
    categories: List[str]


class AITopicRequest(BaseModel):
    category: Optional[str] = None
    genre: Optional[str] = None
    channel: Optional[str] = None
    book_id: Optional[str] = None
    reference_novel: Optional[str] = None
    custom_angle: Optional[str] = None
    model_id: Optional[str] = None
    provider_id: Optional[str] = None


class TopicSuggestion(BaseModel):
    title: str
    one_sentence_hook: str
    hook: Optional[str] = None
    golden_finger: str
    protagonist_setup: str
    character_contrast: Optional[str] = None
    three_chapter_rhythm: str
    market_logic: str

    @model_validator(mode="after")
    def populate_aliases(self) -> "TopicSuggestion":
        if self.hook is None:
            self.hook = self.one_sentence_hook
        if self.character_contrast is None:
            self.character_contrast = self.protagonist_setup
        return self


class AITopicResponse(BaseModel):
    category: str
    source_book_title: Optional[str] = None
    suggestions: List[TopicSuggestion]
    proposals: List[TopicSuggestion] = Field(default_factory=list)

    @model_validator(mode="after")
    def populate_proposals(self) -> "AITopicResponse":
        if not self.proposals:
            self.proposals = self.suggestions
        return self
