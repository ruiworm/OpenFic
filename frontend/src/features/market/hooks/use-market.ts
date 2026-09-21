/**
 * 市场扫榜 React Query Hooks
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBookDetail,
  fetchMarketOverview,
  fetchMarketRankings,
  generateAITopic,
  syncMarketData,
} from "../lib/market-api";
import type { AITopicRequest } from "../types/market.types";

export const MARKET_OVERVIEW_QUERY_KEY = ["market-overview"];
export const MARKET_RANKS_QUERY_KEY = ["market-ranks"];
export const MARKET_BOOK_QUERY_KEY = ["market-book"];

export function useMarketOverview() {
  return useQuery({
    queryKey: MARKET_OVERVIEW_QUERY_KEY,
    queryFn: fetchMarketOverview,
    staleTime: 60 * 1000,
  });
}

export function useMarketRankings(params?: {
  channel?: string;
  category?: string;
  rank_type?: string;
  sort_by?: string;
  search?: string;
  page?: number;
  page_size?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...MARKET_RANKS_QUERY_KEY, params],
    queryFn: () => fetchMarketRankings(params),
    staleTime: 30 * 1000,
  });
}

export function useBookDetail(bookId: string | null) {
  return useQuery({
    queryKey: [...MARKET_BOOK_QUERY_KEY, bookId],
    queryFn: () => (bookId ? fetchBookDetail(bookId) : null),
    enabled: !!bookId,
  });
}

export function useAITopic() {
  return useMutation({
    mutationFn: (payload: AITopicRequest) => generateAITopic(payload),
  });
}

export function useSyncMarket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncMarketData,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MARKET_OVERVIEW_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: MARKET_RANKS_QUERY_KEY });
    },
  });
}

// 常用别名导出
export const useMarketRanks = useMarketRankings;
export const useMarketBookDetail = useBookDetail;
export const useGenerateTopic = useAITopic;
export const useSyncMarketData = useSyncMarket;
