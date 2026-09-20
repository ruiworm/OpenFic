import { Button, Dialog, Flex, Text, TextArea, TextField } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { SimpleSelect, toast } from "@/components";
import type { ChapterListItem } from "@/lib/chapter.types";
import type {
  CreateForeshadowingPayload,
  Foreshadowing,
  ForeshadowingImportance,
  ForeshadowingStatus,
} from "@/types/foreshadowing";

import {
  useCreateForeshadowing,
  useUpdateForeshadowing,
} from "../hooks/use-foreshadowings";

interface ForeshadowingDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Foreshadowing | null;
  chapters?: ChapterListItem[];
  currentChapterId?: string | null;
}

export function ForeshadowingDialog({
  projectId,
  open,
  onOpenChange,
  initialData,
  chapters = [],
  currentChapterId,
}: ForeshadowingDialogProps) {
  const { t } = useTranslation();
  const createMutation = useCreateForeshadowing(projectId);
  const updateMutation = useUpdateForeshadowing(projectId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ForeshadowingStatus>("planted");
  const [importance, setImportance] = useState<ForeshadowingImportance>("major");
  const [plantedChapterId, setPlantedChapterId] = useState<string>("");
  const [targetChapterId, setTargetChapterId] = useState<string>("");
  const [resolvedChapterId, setResolvedChapterId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const isEditing = !!initialData;
  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || "");
      setStatus(initialData.status);
      setImportance(initialData.importance);
      setPlantedChapterId(initialData.planted_chapter_id || "");
      setTargetChapterId(initialData.target_chapter_id || "");
      setResolvedChapterId(initialData.resolved_chapter_id || "");
      setNotes(initialData.notes || "");
    } else {
      setTitle("");
      setDescription("");
      setStatus("planted");
      setImportance("major");
      setPlantedChapterId(currentChapterId || "");
      setTargetChapterId("");
      setResolvedChapterId("");
      setNotes("");
    }
  }, [open, initialData, currentChapterId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error(t("writing.foreshadowing.titleRequired", "请输入伏笔标题"));
      return;
    }

    try {
      if (isEditing && initialData) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          data: {
            title: trimmedTitle,
            description: description.trim(),
            status,
            importance,
            planted_chapter_id: plantedChapterId || null,
            target_chapter_id: targetChapterId.trim() || null,
            resolved_chapter_id: resolvedChapterId || null,
            notes: notes.trim(),
          },
        });
        toast.success(t("writing.foreshadowing.updateSuccess", "伏笔已更新"));
      } else {
        const payload: CreateForeshadowingPayload = {
          title: trimmedTitle,
          description: description.trim(),
          status,
          importance,
          planted_chapter_id: plantedChapterId || null,
          target_chapter_id: targetChapterId.trim() || null,
          resolved_chapter_id: resolvedChapterId || null,
          notes: notes.trim(),
        };
        await createMutation.mutateAsync(payload);
        toast.success(t("writing.foreshadowing.createSuccess", "伏笔已创建"));
      }
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : t("writing.foreshadowing.saveFailed", "保存伏笔失败"),
      );
    }
  };

  const statusOptions = [
    { value: "planted", label: t("writing.foreshadowing.statusPlanted", "埋设中 (待回收)") },
    { value: "developing", label: t("writing.foreshadowing.statusDeveloping", "推进中 (铺垫中)") },
    { value: "resolved", label: t("writing.foreshadowing.statusResolved", "已回收 (已填坑)") },
    { value: "abandoned", label: t("writing.foreshadowing.statusAbandoned", "已弃用") },
  ];

  const importanceOptions = [
    { value: "major", label: t("writing.foreshadowing.importanceMajor", "主线核心") },
    { value: "minor", label: t("writing.foreshadowing.importanceMinor", "支线暗线") },
    { value: "clue", label: t("writing.foreshadowing.importanceClue", "细节彩蛋") },
  ];

  const chapterOptions = [
    { value: "", label: t("writing.foreshadowing.noChapter", "无关联章节") },
    ...chapters.map((ch) => ({
      value: ch.id,
      label: `${ch.order ? `第${ch.order}章 ` : ""}${ch.title || t("chapter.untitled")}`,
    })),
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>
          {isEditing
            ? t("writing.foreshadowing.editTitle", "编辑伏笔与暗线")
            : t("writing.foreshadowing.createTitle", "新建伏笔与暗线")}
        </Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          {t(
            "writing.foreshadowing.dialogDesc",
            "记录伏笔设想与预期收束节点，AI 创作与审校时将主动结合未回收暗线。",
          )}
        </Dialog.Description>

        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="3">
            <div>
              <Text as="label" size="2" weight="medium" mb="1">
                {t("writing.foreshadowing.fieldTitle", "伏笔名称 / 核心线索 *")}
              </Text>
              <TextField.Root
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("writing.foreshadowing.titlePlaceholder", "例如：随身黑石项链的暗红微光")}
                autoFocus
                required
              />
            </div>

            <Flex gap="3">
              <div style={{ flex: 1 }}>
                <Text as="label" size="2" weight="medium" mb="1">
                  {t("writing.foreshadowing.fieldStatus", "当前状态")}
                </Text>
                <SimpleSelect
                  value={status}
                  onValueChange={(val) => setStatus(val as ForeshadowingStatus)}
                  options={statusOptions}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Text as="label" size="2" weight="medium" mb="1">
                  {t("writing.foreshadowing.fieldImportance", "重要等级")}
                </Text>
                <SimpleSelect
                  value={importance}
                  onValueChange={(val) => setImportance(val as ForeshadowingImportance)}
                  options={importanceOptions}
                />
              </div>
            </Flex>

            <div>
              <Text as="label" size="2" weight="medium" mb="1">
                {t("writing.foreshadowing.fieldPlantedChapter", "首次埋设章节")}
              </Text>
              <SimpleSelect
                value={plantedChapterId}
                onValueChange={setPlantedChapterId}
                options={chapterOptions}
              />
            </div>

            <Flex gap="3">
              <div style={{ flex: 1 }}>
                <Text as="label" size="2" weight="medium" mb="1">
                  {t("writing.foreshadowing.fieldTargetChapter", "预期回收节点 (卷/章)")}
                </Text>
                <TextField.Root
                  value={targetChapterId}
                  onChange={(e) => setTargetChapterId(e.target.value)}
                  placeholder={t("writing.foreshadowing.targetPlaceholder", "如：第15章 / 第二卷决战")}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Text as="label" size="2" weight="medium" mb="1">
                  {t("writing.foreshadowing.fieldResolvedChapter", "实际回收章节")}
                </Text>
                <SimpleSelect
                  value={resolvedChapterId}
                  onValueChange={setResolvedChapterId}
                  options={chapterOptions}
                />
              </div>
            </Flex>

            <div>
              <Text as="label" size="2" weight="medium" mb="1">
                {t("writing.foreshadowing.fieldDescription", "伏笔设定 / 详细描述")}
              </Text>
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(
                  "writing.foreshadowing.descPlaceholder",
                  "描述伏笔在正文中的埋设方式、暗指意象与背后秘密...",
                )}
                rows={3}
              />
            </div>

            <div>
              <Text as="label" size="2" weight="medium" mb="1">
                {t("writing.foreshadowing.fieldNotes", "备忘笔记 / 回收要点")}
              </Text>
              <TextArea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t(
                  "writing.foreshadowing.notesPlaceholder",
                  "作者补充备忘，或填坑时的特别注意点...",
                )}
                rows={2}
              />
            </div>

            <Flex gap="3" justify="end" mt="3">
              <Button
                variant="soft"
                color="gray"
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                {t("common.cancel", "取消")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("common.saving", "保存中...") : t("common.save", "保存")}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
