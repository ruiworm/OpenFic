import { SegmentedControl } from "@radix-ui/themes";
import { BookOpen, FileText, Bookmark } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useWritingStore } from "../store/use-writing-store";
import { ChapterSidebar } from "./chapter-sidebar";
import { ForeshadowingSidebar } from "./foreshadowing-sidebar";
import { NoteSidebar } from "./note-sidebar";

interface WritingSidebarProps {
  projectId: string;
  onChapterSelect: (chapterId: string, chapterTitle: string) => void;
  onNoteSelect: (noteId: string, noteTitle: string) => void;
  onAddToConversation?: (markup: string) => void;
  isAgentLocked?: boolean;
  compact?: boolean;
  initialCurrentChapterNavigationKey?: string | null;
  onOpenSummary?: () => void;
}

export function WritingSidebar({
  projectId,
  onChapterSelect,
  onNoteSelect,
  onAddToConversation,
  isAgentLocked = false,
  compact = false,
  initialCurrentChapterNavigationKey = null,
  onOpenSummary,
}: WritingSidebarProps) {
  const { t } = useTranslation();
  const sidebarView = useWritingStore((s) => s.sidebarView);
  const setSidebarView = useWritingStore((s) => s.setSidebarView);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-background)",
      }}
    >
      <div
        style={{
          padding: compact ? "8px 8px" : "10px 12px",
          borderBottom: "1px solid var(--gray-a4)",
          background: "color-mix(in srgb, var(--color-background) 94%, transparent)",
        }}
      >
        <SegmentedControl.Root
          value={sidebarView}
          onValueChange={(value) =>
            setSidebarView(value as "chapters" | "notes" | "foreshadowings")
          }
          size="2"
          className="writing-sidebar-segmented-control"
          style={{ width: "100%", borderRadius: "8px" }}
        >
          <SegmentedControl.Item value="chapters">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <BookOpen size={13} />
              {t("writing.chapters")}
            </span>
          </SegmentedControl.Item>
          <SegmentedControl.Item value="notes">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <FileText size={13} />
              {t("writing.notes")}
            </span>
          </SegmentedControl.Item>
          <SegmentedControl.Item value="foreshadowings">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Bookmark size={13} />
              {t("writing.foreshadowings", "伏笔")}
            </span>
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      </div>

      {sidebarView === "chapters" ? (
        <ChapterSidebar
          projectId={projectId}
          onChapterSelect={onChapterSelect}
          onAddToConversation={onAddToConversation}
          isAgentLocked={isAgentLocked}
          compact={compact}
          initialCurrentChapterNavigationKey={initialCurrentChapterNavigationKey}
          onOpenSummary={onOpenSummary}
        />
      ) : sidebarView === "notes" ? (
        <NoteSidebar
          projectId={projectId}
          onNoteSelect={onNoteSelect}
          onAddToConversation={onAddToConversation}
          isAgentLocked={isAgentLocked}
          compact={compact}
        />
      ) : (
        <ForeshadowingSidebar
          projectId={projectId}
          onAddToConversation={onAddToConversation}
          isAgentLocked={isAgentLocked}
          compact={compact}
        />
      )}
    </div>
  );
}
