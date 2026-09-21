/**
 * 市场扫榜 API 客户端
 */

import { apiClient } from "@/lib/api-client";
import type {
  AITopicRequest,
  AITopicResponse,
  BookDetailResponse,
  MarketOverviewResponse,
  MarketRankResponse,
} from "../types/market.types";

export async function fetchMarketOverview(): Promise<MarketOverviewResponse> {
  const res = await apiClient.get<MarketOverviewResponse>("/market/overview");
  return res.data;
}

export async function fetchMarketRankings(params?: {
  channel?: string;
  category?: string;
  rank_type?: string;
  sort_by?: string;
  search?: string;
  page?: number;
  page_size?: number;
  limit?: number;
}): Promise<MarketRankResponse> {
  const res = await apiClient.get<MarketRankResponse>("/market/ranks", {
    params: {
      channel: params?.channel && params.channel !== "all" ? params.channel : undefined,
      category: params?.category && params.category !== "all" ? params.category : undefined,
      rank_type: params?.sort_by || params?.rank_type || "read_count",
      search: params?.search?.trim() || undefined,
      page: params?.page ?? 1,
      page_size: params?.limit ?? params?.page_size ?? 20,
    },
  });
  return res.data;
}

export async function fetchBookDetail(bookId: string): Promise<BookDetailResponse> {
  const res = await apiClient.get<BookDetailResponse>(`/market/books/${bookId}`);
  return res.data;
}

export async function generateAITopic(payload: AITopicRequest): Promise<AITopicResponse> {
  const res = await apiClient.post<AITopicResponse>("/market/ai-topic", payload);
  return res.data;
}

export async function syncMarketData(): Promise<{ status: string; message: string }> {
  const res = await apiClient.post<{ status: string; message: string }>("/market/sync");
  return res.data;
}
