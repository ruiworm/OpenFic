/**
 * 市场扫榜与大盘洞察类型定义
 */

export interface TrendDataPoint {
  date: string;
  read_count: number;
  in_read_count?: number;
  rank: number;
}

export interface GenreMetric {
  name: string;
  channel: "male" | "female";
  total_read_count: number;
  read_count_formatted: string;
  growth_rate_7d: number;
  growth_rate_30d: number;
  daily_debut_count: number;
  turnover_rate: number;
  competition_level: "low" | "medium" | "high" | "intense";
  is_blue_ocean: boolean;
  summary: string;
}

export interface MarketOverviewResponse {
  total_market_read_count: number;
  total_market_read_formatted: string;
  top_growing_genre: GenreMetric;
  most_competitive_genre: GenreMetric;
  blue_ocean_genre: GenreMetric;
  genres: GenreMetric[];
  updated_at: string;
}

export interface MarketBook {
  id?: string;
  book_id: string;
  title: string;
  author: string;
  channel: "male" | "female";
  category: string;
  tags: string[];
  cover_url?: string | null;
  intro: string;
  word_count: number;
  debut_days: number;
  score: number;
  read_count: number;
  read_count_formatted: string;
  gain_7d: number;
  gain_7d_formatted: string;
  gain_30d: number;
  gain_30d_formatted: string;
  growth_rate_7d: number;
  status: "surging" | "stable" | "declining" | "fake_spike";
  lifecycle_status?: "surging" | "stable" | "declining" | "fake_spike";
  rank: number;
  platform?: string;
  delta_7d?: number;
  delta_30d?: number;
  in_read_count?: number;
  is_debut?: boolean;
}

export interface ChapterBrief {
  chapter_index: number;
  chapter_num?: number;
  title: string;
  word_count: number;
  content_preview: string;
  content: string;
}

export interface BookDetailResponse extends MarketBook {
  history_trends_7d: TrendDataPoint[];
  history_trends_30d: TrendDataPoint[];
  trend_7d?: TrendDataPoint[];
  trend_30d?: TrendDataPoint[];
  author_works: Array<{ title: string; read_count: string; is_current: boolean }>;
  sample_chapters: ChapterBrief[];
}

export type MarketBookDetail = BookDetailResponse;

export interface MarketRankResponse {
  items: MarketBook[];
  total: number;
  page: number;
  page_size: number;
  channels: string[];
  categories: string[];
}

export interface TopicSuggestion {
  title: string;
  one_sentence_hook: string;
  hook?: string;
  golden_finger: string;
  protagonist_setup: string;
  character_contrast?: string;
  three_chapter_rhythm: string;
  market_logic: string;
}

export type AITopicProposal = TopicSuggestion;

export interface AITopicRequest {
  category?: string;
  genre?: string;
  channel?: string;
  book_id?: string;
  reference_novel?: string;
  custom_angle?: string;
  model_id?: string;
  provider_id?: string;
}

export interface AITopicResponse {
  category: string;
  source_book_title?: string | null;
  suggestions: TopicSuggestion[];
  proposals?: TopicSuggestion[];
}
