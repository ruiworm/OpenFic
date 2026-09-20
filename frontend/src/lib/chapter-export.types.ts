export interface ChapterExportCreate {
  selectedVolumeIds: string[];
  includedChapterIds: string[];
  excludedChapterIds: string[];
  localDate: string;
  format?: "txt" | "epub" | "markdown";
}

export interface ChapterExport {
  id: string;
  status: string;
  filename: string;
  mode: "chapters" | "volumes";
  format?: "txt" | "epub" | "markdown";
  volumeCount: number;
  chapterCount: number;
  wordCount: number;
  chapterIds: string[];
  current: number;
  total: number;
  stage: string | null;
  chapterTitle: string | null;
  expiresAt: string | null;
  downloadUrl: string | null;
  errorMessage: string | null;
}
