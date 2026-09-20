export type ForeshadowingStatus = "planted" | "developing" | "resolved" | "abandoned";
export type ForeshadowingImportance = "major" | "minor" | "clue";

export interface Foreshadowing {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: ForeshadowingStatus;
  importance: ForeshadowingImportance;
  planted_chapter_id: string | null;
  target_chapter_id: string | null;
  resolved_chapter_id: string | null;
  character_ids: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ForeshadowingListResponse {
  items: Foreshadowing[];
  total: number;
}

export interface CreateForeshadowingPayload {
  title: string;
  description?: string;
  status?: ForeshadowingStatus;
  importance?: ForeshadowingImportance;
  planted_chapter_id?: string | null;
  target_chapter_id?: string | null;
  resolved_chapter_id?: string | null;
  character_ids?: string[];
  notes?: string;
}

export interface UpdateForeshadowingPayload {
  title?: string;
  description?: string;
  status?: ForeshadowingStatus;
  importance?: ForeshadowingImportance;
  planted_chapter_id?: string | null;
  target_chapter_id?: string | null;
  resolved_chapter_id?: string | null;
  character_ids?: string[];
  notes?: string;
}
