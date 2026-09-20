/**
 * 拆书历史记录抽屉 / 对话框
 */

import { Dialog, Button, Flex, Text, Box, TextField, ScrollArea, IconButton, Tooltip } from "@radix-ui/themes";
import { History, Search, Trash2, BookOpen, Clock, FileText } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeconstructionHistory, useDeleteDeconstruction } from "../hooks/use-deconstruction";
import type { Deconstruction } from "@/types/deconstruction";

interface DeconstructionHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectReport: (report: Deconstruction) => void;
}

export function DeconstructionHistoryDrawer({
  open,
  onOpenChange,
  onSelectReport,
}: DeconstructionHistoryDrawerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useDeconstructionHistory(search);
  const deleteMutation = useDeleteDeconstruction();

  const items = data?.items ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px" style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <Dialog.Title>
          <Flex align="center" gap="2">
            <History size={20} />
            <Text>{t("deconstruction.historyTitle", "拆书历史记录")}</Text>
          </Flex>
        </Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          {t("deconstruction.historyDesc", "查看您过往生成的所有小说拆解分析报告，随时重新载入或转化为新书。")}
        </Dialog.Description>

        <Box mb="3">
          <TextField.Root
            placeholder={t("deconstruction.searchHistoryPlaceholder", "按标题或原书名搜索...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          >
            <TextField.Slot>
              <Search size={16} color="var(--gray-9)" />
            </TextField.Slot>
          </TextField.Root>
        </Box>

        <ScrollArea style={{ flex: 1, minHeight: 250, maxHeight: 420 }}>
          {isLoading ? (
            <Flex align="center" justify="center" p="6">
              <Text size="2" color="gray">
                {t("common.loading", "加载中...")}
              </Text>
            </Flex>
          ) : items.length === 0 ? (
            <Flex direction="column" align="center" justify="center" p="6" gap="2">
              <FileText size={32} color="var(--gray-7)" />
              <Text size="2" color="gray">
                {t("deconstruction.noHistory", "暂无历史拆书报告")}
              </Text>
            </Flex>
          ) : (
            <Flex direction="column" gap="2" pr="2">
              {items.map((item) => (
                <Box
                  key={item.id}
                  p="3"
                  style={{
                    background: "var(--gray-a2)",
                    borderRadius: "var(--radius-3)",
                    border: "1px solid var(--gray-a4)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => {
                    onSelectReport(item);
                    onOpenChange(false);
                  }}
                >
                  <Flex justify="between" align="start">
                    <Box style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <Text size="2" weight="bold" style={{ display: "block" }}>
                        {item.title}
                      </Text>
                      {item.source_title && (
                        <Flex align="center" gap="1" mt="1">
                          <BookOpen size={12} color="var(--accent-9)" />
                          <Text size="1" color="gray">
                            {t("deconstruction.sourceBook", "原著：")}
                            {item.source_title}
                          </Text>
                        </Flex>
                      )}
                      {item.source_preview && (
                        <Text
                          size="1"
                          color="gray"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            marginTop: 4,
                          }}
                        >
                          {item.source_preview}
                        </Text>
                      )}
                      <Flex align="center" gap="3" mt="2">
                        <Flex align="center" gap="1">
                          <Clock size={11} color="var(--gray-8)" />
                          <Text size="1" color="gray">
                            {new Date(item.created_at).toLocaleString()}
                          </Text>
                        </Flex>
                        {item.source_word_count > 0 && (
                          <Text size="1" color="gray">
                            {item.source_word_count.toLocaleString()} {t("common.words", "字")}
                          </Text>
                        )}
                      </Flex>
                    </Box>

                    <Tooltip content={t("common.delete", "删除")}>
                      <IconButton
                        size="1"
                        variant="ghost"
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(item.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </Tooltip>
                  </Flex>
                </Box>
              ))}
            </Flex>
          )}
        </ScrollArea>

        <Flex justify="end" mt="3">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              {t("common.close", "关闭")}
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
