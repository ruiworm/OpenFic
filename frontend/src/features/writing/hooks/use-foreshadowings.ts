/**
 * Foreshadowing Hooks
 *
 * 伏笔与线索数据操作的 React Query hooks。
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type {
  CreateForeshadowingPayload,
  Foreshadowing,
  ForeshadowingImportance,
  ForeshadowingListResponse,
  ForeshadowingStatus,
  UpdateForeshadowingPayload,
} from "@/types/foreshadowing";

export interface ForeshadowingFilterParams {
  status?: ForeshadowingStatus;
  importance?: ForeshadowingImportance;
  chapterId?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchForeshadowings(
  projectId: string,
  params?: ForeshadowingFilterParams,
): Promise<ForeshadowingListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append("status", params.status);
  if (params?.importance) queryParams.append("importance", params.importance);
  if (params?.chapterId) queryParams.append("chapter_id", params.chapterId);
  if (params?.page) queryParams.append("page", String(params.page));
  if (params?.pageSize) queryParams.append("page_size", String(params.pageSize));

  const qs = queryParams.toString();
  const url = `/projects/${projectId}/foreshadowings${qs ? `?${qs}` : ""}`;
  const response = await apiClient.get<ForeshadowingListResponse>(url);
  return response.data;
}

export async function createForeshadowing(
  projectId: string,
  data: CreateForeshadowingPayload,
): Promise<Foreshadowing> {
  const response = await apiClient.post<Foreshadowing>(
    `/projects/${projectId}/foreshadowings`,
    data,
  );
  return response.data;
}

export async function updateForeshadowing(
  projectId: string,
  id: string,
  data: UpdateForeshadowingPayload,
): Promise<Foreshadowing> {
  const response = await apiClient.patch<Foreshadowing>(
    `/projects/${projectId}/foreshadowings/${id}`,
    data,
  );
  return response.data;
}

export async function deleteForeshadowing(
  projectId: string,
  id: string,
): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/foreshadowings/${id}`);
}

export function useForeshadowings(
  projectId: string,
  params?: ForeshadowingFilterParams,
) {
  return useQuery({
    queryKey: ["foreshadowings", projectId, params],
    queryFn: () => fetchForeshadowings(projectId, params),
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

export function useCreateForeshadowing(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateForeshadowingPayload) =>
      createForeshadowing(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foreshadowings", projectId] });
    },
  });
}

export function useUpdateForeshadowing(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateForeshadowingPayload }) =>
      updateForeshadowing(projectId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foreshadowings", projectId] });
    },
  });
}

export function useDeleteForeshadowing(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteForeshadowing(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foreshadowings", projectId] });
    },
  });
}
