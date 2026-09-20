import {
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  SegmentedControl,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import {
  Check,
  CheckCircle2,
  Clock,
  HelpCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ConfirmDialog, toast } from "@/components";
import type { ChapterListItem } from "@/lib/chapter.types";
import type {
  Foreshadowing,
  ForeshadowingImportance,
  ForeshadowingStatus,
} from "@/types/foreshadowing";

import {
  useDeleteForeshadowing,
  useForeshadowings,
  useUpdateForeshadowing,
} from "../hooks/use-foreshadowings";
import { useVolumeTree } from "../hooks/use-volumes";
import { ForeshadowingDialog } from "./foreshadowing-dialog";

interface ForeshadowingSidebarProps {
  projectId: string;
  onAddToConversation?: (markup: string) => void;
  isAgentLocked?: boolean;
  compact?: boolean;
}

export function ForeshadowingSidebar({
  projectId,
  onAddToConversation,
  isAgentLocked = false,
  compact = false,
}: ForeshadowingSidebarProps) {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Foreshadowing | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Foreshadowing | null>(null);

  const { data: volumeTreeData } = useVolumeTree(projectId);
  const chapters: ChapterListItem[] = useMemo(() => {
    if (!volumeTreeData?.volumes) return [];
    return volumeTreeData.volumes.flatMap((v) => v.chapters || []);
  }, [volumeTreeData]);

  const chapterMap = useMemo(() => {
    const map = new Map<string, string>();
    chapters.forEach((ch) => {
      map.set(ch.id, `${ch.order ? `第${ch.order}章 ` : ""}${ch.title}`);
    });
    return map;
  }, [chapters]);

  const { data: foreshadowingData, isLoading } = useForeshadowings(projectId, {
    status: statusFilter === "all" ? undefined : (statusFilter as ForeshadowingStatus),
  });

  const updateMutation = useUpdateForeshadowing(projectId);
  const deleteMutation = useDeleteForeshadowing(projectId);

  const items = foreshadowingData?.items || [];
  const pendingCount = items.filter((i) => i.status === "planted" || i.status === "developing").length;

  const handleOpenCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: Foreshadowing) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleQuickResolve = async (item: Foreshadowing) => {
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        data: { status: "resolved" },
      });
      toast.success(t("writing.foreshadowing.resolvedSuccess", "已标记为已回收"));
    } catch {
      toast.error(t("writing.foreshadowing.operationFailed", "操作失败"));
    }
  };

  const handleSendToChat = (item: Foreshadowing) => {
    if (!onAddToConversation) return;
    const text = `【伏笔暗线】${item.title}\n状态：${getStatusLabel(item.status)}\n重要度：${getImportanceLabel(item.importance)}\n描述：${item.description || "无"}\n备注：${item.notes || "无"}`;
    onAddToConversation(text);
    toast.success(t("writing.foreshadowing.sentToChat", "已发送到助手对话框"));
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmItem) return;
    try {
      await deleteMutation.mutateAsync(deleteConfirmItem.id);
      toast.success(t("writing.foreshadowing.deleteSuccess", "伏笔已删除"));
      setDeleteConfirmItem(null);
    } catch {
      toast.error(t("writing.foreshadowing.deleteFailed", "删除失败"));
    }
  };

  const getStatusBadge = (status: ForeshadowingStatus) => {
    switch (status) {
      case "planted":
        return <Badge color="amber" variant="surface">{t("writing.foreshadowing.statusPlanted", "待回收")}</Badge>;
      case "developing":
        return <Badge color="blue" variant="surface">{t("writing.foreshadowing.statusDeveloping", "推进中")}</Badge>;
      case "resolved":
        return <Badge color="green" variant="surface">{t("writing.foreshadowing.statusResolved", "已回收")}</Badge>;
      case "abandoned":
        return <Badge color="gray" variant="surface">{t("writing.foreshadowing.statusAbandoned", "已弃用")}</Badge>;
    }
  };

  const getStatusLabel = (status: ForeshadowingStatus) => {
    switch (status) {
      case "planted": return "待回收";
      case "developing": return "推进中";
      case "resolved": return "已回收";
      case "abandoned": return "已弃用";
    }
  };

  const getImportanceBadge = (importance: ForeshadowingImportance) => {
    switch (importance) {
      case "major":
        return <Badge color="ruby" size="1">{t("writing.foreshadowing.importanceMajor", "主线")}</Badge>;
      case "minor":
        return <Badge color="cyan" size="1">{t("writing.foreshadowing.importanceMinor", "支线")}</Badge>;
      case "clue":
        return <Badge color="purple" size="1">{t("writing.foreshadowing.importanceClue", "暗线细节")}</Badge>;
    }
  };

  const getImportanceLabel = (importance: ForeshadowingImportance) => {
    switch (importance) {
      case "major": return "主线核心";
      case "minor": return "支线暗线";
      case "clue": return "暗线细节";
    }
  };

  return (
    <Flex direction="column" style={{ height: "100%", overflow: "hidden" }}>
      {/* 头部操作栏 */}
      <Box p={compact ? "2" : "3"} style={{ borderBottom: "1px solid var(--gray-a4)" }}>
        <Flex justify="between" align="center" mb="2">
          <Flex align="center" gap="2">
            <Text size="2" weight="bold">
              {t("writing.foreshadowing.sidebarTitle", "伏笔追踪与填坑")}
            </Text>
            {pendingCount > 0 && (
              <Badge color="amber" radius="full" size="1">
                {pendingCount}
              </Badge>
            )}
          </Flex>
          <Button size="1" onClick={handleOpenCreate} disabled={isAgentLocked}>
            <Plus size={14} />
            {t("writing.foreshadowing.addBtn", "新建")}
          </Button>
        </Flex>

        {/* 状态过滤切换 */}
        <SegmentedControl.Root
          value={statusFilter}
          onValueChange={setStatusFilter}
          size="1"
          style={{ width: "100%" }}
        >
          <SegmentedControl.Item value="all">{t("common.all", "全部")}</SegmentedControl.Item>
          <SegmentedControl.Item value="planted">{t("writing.foreshadowing.filterPlanted", "待回收")}</SegmentedControl.Item>
          <SegmentedControl.Item value="developing">{t("writing.foreshadowing.filterDeveloping", "推进中")}</SegmentedControl.Item>
          <SegmentedControl.Item value="resolved">{t("writing.foreshadowing.filterResolved", "已回收")}</SegmentedControl.Item>
        </SegmentedControl.Root>
      </Box>

      {/* 伏笔卡片列表 */}
      <Box style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        {isLoading ? (
          <Text size="2" color="gray" align="center" style={{ display: "block", marginTop: "2rem" }}>
            {t("common.loading", "加载中...")}
          </Text>
        ) : items.length === 0 ? (
          <Box p="4" style={{ textAlign: "center", color: "var(--gray-9)" }}>
            <Clock size={32} style={{ margin: "1rem auto 0.5rem", opacity: 0.4 }} />
            <Text size="2" style={{ display: "block" }}>
              {t("writing.foreshadowing.empty", "暂无符合条件的伏笔")}
            </Text>
            <Text size="1" color="gray" style={{ display: "block", marginTop: "4px" }}>
              {t("writing.foreshadowing.emptyTip", "在创作中埋入暗线时，点击上方“新建”方便后续填坑")}
            </Text>
          </Box>
        ) : (
          <Flex direction="column" gap="2">
            {items.map((item) => {
              const plantedChapterTitle = item.planted_chapter_id
                ? chapterMap.get(item.planted_chapter_id)
                : null;
              const resolvedChapterTitle = item.resolved_chapter_id
                ? chapterMap.get(item.resolved_chapter_id)
                : null;

              return (
                <Box
                  key={item.id}
                  p="3"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radius-3)",
                    border: "1px solid var(--gray-a4)",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  <Flex justify="between" align="start" gap="2" mb="1">
                    <Text size="2" weight="bold" style={{ wordBreak: "break-word" }}>
                      {item.title}
                    </Text>
                    <Flex gap="1" align="center" style={{ flexShrink: 0 }}>
                      {getImportanceBadge(item.importance)}
                      {getStatusBadge(item.status)}
                    </Flex>
                  </Flex>

                  {item.description && (
                    <Text
                      size="1"
                      color="gray"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        marginTop: "4px",
                        marginBottom: "6px",
                      }}
                    >
                      {item.description}
                    </Text>
                  )}

                  {/* 章节关联提示 */}
                  <Flex wrap="wrap" gap="2" align="center" style={{ fontSize: "11px", color: "var(--gray-10)" }}>
                    {plantedChapterTitle && (
                      <Text size="1">
                        🌱 埋于: {plantedChapterTitle}
                      </Text>
                    )}
                    {item.target_chapter_id && (
                      <Text size="1">
                        🎯 目标: {item.target_chapter_id}
                      </Text>
                    )}
                    {resolvedChapterTitle && (
                      <Text size="1" color="green">
                        ✅ 回收于: {resolvedChapterTitle}
                      </Text>
                    )}
                  </Flex>

                  {/* 卡片底栏操作按钮 */}
                  <Flex justify="end" gap="1" mt="2" style={{ borderTop: "1px dashed var(--gray-a3)", paddingTop: "4px" }}>
                    {item.status !== "resolved" && (
                      <Tooltip content={t("writing.foreshadowing.quickResolve", "标记为已回收")}>
                        <IconButton
                          size="1"
                          variant="ghost"
                          color="green"
                          onClick={() => handleQuickResolve(item)}
                        >
                          <Check size={13} />
                        </IconButton>
                      </Tooltip>
                    )}

                    {onAddToConversation && (
                      <Tooltip content={t("writing.foreshadowing.sendToChat", "发送到 AI 对话")}>
                        <IconButton
                          size="1"
                          variant="ghost"
                          color="blue"
                          onClick={() => handleSendToChat(item)}
                        >
                          <Send size={13} />
                        </IconButton>
                      </Tooltip>
                    )}

                    <Tooltip content={t("common.edit", "编辑")}>
                      <IconButton
                        size="1"
                        variant="ghost"
                        color="gray"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <Pencil size={13} />
                      </IconButton>
                    </Tooltip>

                    <Tooltip content={t("common.delete", "删除")}>
                      <IconButton
                        size="1"
                        variant="ghost"
                        color="red"
                        onClick={() => setDeleteConfirmItem(item)}
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </Tooltip>
                  </Flex>
                </Box>
              );
            })}
          </Flex>
        )}
      </Box>

      {/* 弹窗与确认框 */}
      <ForeshadowingDialog
        projectId={projectId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editingItem}
        chapters={chapters}
      />

      <ConfirmDialog
        open={!!deleteConfirmItem}
        title={t("writing.foreshadowing.deleteConfirmTitle", "确认删除伏笔")}
        description={t(
          "writing.foreshadowing.deleteConfirmDesc",
          "删除后将无法恢复此伏笔记录，确认删除吗？",
        )}
        onOpenChange={(open) => !open && setDeleteConfirmItem(null)}
        onConfirm={handleDeleteConfirm}
        confirmColor="red"
      />
    </Flex>
  );
}
