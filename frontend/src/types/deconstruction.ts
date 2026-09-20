/**
 * 小说拆书与仿写相关类型定义
 */

export interface Deconstruction {
  id: string;
  title: string;
  source_title: string;
  source_preview: string;
  source_word_count: number;
  source_text: string;
  model_id: string;
  prompt_template: string;
  report_markdown: string;
  created_at: string;
  updated_at: string;
}

export interface DeconstructionListResponse {
  items: Deconstruction[];
  total: number;
  page: number;
  page_size: number;
}

export interface DeconstructionStreamRequest {
  text: string;
  model_id?: string;
  prompt_template?: string;
  title?: string;
  source_title?: string;
}

export interface DeconstructionCreateRequest {
  title: string;
  source_title?: string;
  source_preview?: string;
  source_word_count?: number;
  source_text?: string;
  model_id?: string;
  prompt_template?: string;
  report_markdown: string;
}

export interface CreateProjectFromDeconstructionRequest {
  title?: string;
  description?: string;
}

export interface CreateProjectFromDeconstructionResponse {
  project_id: string;
  title: string;
}

export interface ExportToNoteRequest {
  project_id: string;
}

export interface ExportToNoteResponse {
  note_id: string;
  project_id: string;
  title: string;
}
