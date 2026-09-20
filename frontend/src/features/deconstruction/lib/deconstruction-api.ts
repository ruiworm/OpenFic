/**
 * 小说拆书与仿写 API 客户端
 */

import { apiClient, getApiBaseUrl } from "@/lib/api-client";
import type {
  CreateProjectFromDeconstructionRequest,
  CreateProjectFromDeconstructionResponse,
  Deconstruction,
  DeconstructionCreateRequest,
  DeconstructionListResponse,
  DeconstructionStreamRequest,
  ExportToNoteRequest,
  ExportToNoteResponse,
} from "@/types/deconstruction";

export async function fetchDefaultPromptTemplate(): Promise<string> {
  const res = await apiClient.get<{ prompt_template: string }>("/deconstructions/prompt-template");
  return res.data.prompt_template;
}

export async function listDeconstructions(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<DeconstructionListResponse> {
  const res = await apiClient.get<DeconstructionListResponse>("/deconstructions", {
    params: {
      search: params?.search,
      page: params?.page ?? 1,
      page_size: params?.pageSize ?? 20,
    },
  });
  return res.data;
}

export async function getDeconstruction(id: string): Promise<Deconstruction> {
  const res = await apiClient.get<Deconstruction>(`/deconstructions/${id}`);
  return res.data;
}

export async function saveDeconstruction(
  payload: DeconstructionCreateRequest,
): Promise<Deconstruction> {
  const res = await apiClient.post<Deconstruction>("/deconstructions", payload);
  return res.data;
}

export async function deleteDeconstruction(id: string): Promise<void> {
  await apiClient.delete(`/deconstructions/${id}`);
}

export async function createProjectFromDeconstruction(
  id: string,
  payload: CreateProjectFromDeconstructionRequest,
): Promise<CreateProjectFromDeconstructionResponse> {
  const res = await apiClient.post<CreateProjectFromDeconstructionResponse>(
    `/deconstructions/${id}/create-project`,
    payload,
  );
  return res.data;
}

export async function exportDeconstructionToNote(
  id: string,
  payload: ExportToNoteRequest,
): Promise<ExportToNoteResponse> {
  const res = await apiClient.post<ExportToNoteResponse>(
    `/deconstructions/${id}/export-to-note`,
    payload,
  );
  return res.data;
}

/**
 * 流式执行拆书分析，通过回调函数实时接收文本片段
 */
export async function streamDeconstruction(
  payload: DeconstructionStreamRequest,
  callbacks: {
    onChunk: (chunk: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const url = `${getApiBaseUrl()}/deconstructions/stream`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("无法获取流式响应数据");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const dataStr = trimmed.slice(6).trim();
        if (dataStr === "[DONE]") {
          callbacks.onDone();
          return;
        }

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.error) {
            callbacks.onError(new Error(parsed.error));
            return;
          }
          if (parsed.content) {
            callbacks.onChunk(parsed.content);
          }
        } catch {
          // ignore incomplete JSON fragment
        }
      }
    }

    callbacks.onDone();
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
