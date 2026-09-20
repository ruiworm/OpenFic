/**
 * 小说拆书 React Query Hooks
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProjectFromDeconstruction,
  deleteDeconstruction,
  exportDeconstructionToNote,
  fetchDefaultPromptTemplate,
  getDeconstruction,
  listDeconstructions,
  saveDeconstruction,
} from "../lib/deconstruction-api";
import type {
  CreateProjectFromDeconstructionRequest,
  DeconstructionCreateRequest,
  ExportToNoteRequest,
} from "@/types/deconstruction";

export const DECONSTRUCTION_QUERY_KEY = ["deconstructions"];

export function useDefaultPromptTemplate() {
  return useQuery({
    queryKey: ["deconstruction-default-prompt"],
    queryFn: fetchDefaultPromptTemplate,
    staleTime: Infinity,
  });
}

export function useDeconstructionHistory(search?: string, page = 1) {
  return useQuery({
    queryKey: [...DECONSTRUCTION_QUERY_KEY, { search, page }],
    queryFn: () => listDeconstructions({ search, page }),
  });
}

export function useDeconstructionDetail(id: string | null) {
  return useQuery({
    queryKey: [...DECONSTRUCTION_QUERY_KEY, id],
    queryFn: () => (id ? getDeconstruction(id) : null),
    enabled: !!id,
  });
}

export function useSaveDeconstruction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DeconstructionCreateRequest) => saveDeconstruction(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DECONSTRUCTION_QUERY_KEY });
    },
  });
}

export function useDeleteDeconstruction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDeconstruction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DECONSTRUCTION_QUERY_KEY });
    },
  });
}

export function useCreateProjectFromDeconstruction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateProjectFromDeconstructionRequest }) =>
      createProjectFromDeconstruction(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useExportDeconstructionToNote() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExportToNoteRequest }) =>
      exportDeconstructionToNote(id, data),
  });
}
