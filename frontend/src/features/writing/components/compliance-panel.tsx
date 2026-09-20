import {
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  ScrollArea,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import type { Editor } from "@tiptap/react";
import { AlertTriangle, Check, ChevronRight, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { toast } from "@/components";

import type { ComplianceMatch } from "../lib/compliance-rules";

interface CompliancePanelProps {
  editor: Editor | null;
  matches: ComplianceMatch[];
  onClose: () => void;
}

export function CompliancePanel({ editor, matches, onClose }: CompliancePanelProps) {
  const { t } = useTranslation();

  const prohibitedCount = matches.filter((m) => m.category === "prohibited").length;
  const warningCount = matches.filter((m) => m.category === "warning").length;
  const typoCount = matches.filter((m) => m.category === "typo").length;

  const handleJumpToMatch = (match: ComplianceMatch) => {
    if (!editor) return;
    editor.commands.setTextSelection({ from: match.from, to: match.to });
    editor.commands.scrollIntoView();
  };

  const handleReplace = (match: ComplianceMatch) => {
    if (!editor || !match.replacement) return;
    editor.commands.replaceComplianceWord(match.from, match.to, match.replacement);
    toast.success(
      t("writing.compliance.replacedWord", "已将「{{from}}」替换为「{{to}}」", {
        from: match.word,
        to: match.replacement,
      }),
    );
  };

  const handleReplaceAllTypos = () => {
    if (!editor) return;
    const typos = matches.filter((m) => m.category === "typo" && m.replacement);
    if (typos.length === 0) return;

    // 从后往前替换，避免偏移量变动导致位置错乱
    const sortedTypos = [...typos].sort((a, b) => b.from - a.from);
    for (const typo of sortedTypos) {
      if (typo.replacement) {
        editor.commands.replaceComplianceWord(typo.from, typo.to, typo.replacement);
      }
    }
    toast.success(
      t("writing.compliance.allTyposReplaced", "已自动修正 {{count}} 处常见错别字", {
        count: sortedTypos.length,
      }),
    );
  };

  return (
    <Box
      style={{
        position: "absolute",
        right: "16px",
        top: "60px",
        width: "320px",
        maxHeight: "480px",
        backgroundColor: "var(--color-surface)",
        borderRadius: "var(--radius-3)",
        border: "1px solid var(--gray-a6)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.16)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 标题栏 */}
      <Flex
        justify="between"
        align="center"
        p="3"
        style={{ borderBottom: "1px solid var(--gray-a4)" }}
      >
        <Flex align="center" gap="2">
          <ShieldAlert size={16} color="var(--amber-10)" />
          <Text size="2" weight="bold">
            {t("writing.compliance.panelTitle", "网文合规与排雷检测")}
          </Text>
        </Flex>
        <IconButton size="1" variant="ghost" color="gray" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </Flex>

      {/* 概览统计条 */}
      <Flex
        gap="2"
        p="2"
        style={{
          backgroundColor: "var(--gray-a2)",
          borderBottom: "1px solid var(--gray-a4)",
          fontSize: "12px",
        }}
      >
        {prohibitedCount > 0 && (
          <Badge color="red" variant="surface" size="1">
            违禁 {prohibitedCount}
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge color="amber" variant="surface" size="1">
            敏感 {warningCount}
          </Badge>
        )}
        {typoCount > 0 && (
          <Badge color="blue" variant="surface" size="1">
            错字 {typoCount}
          </Badge>
        )}
        {matches.length === 0 && (
          <Flex align="center" gap="1" style={{ color: "var(--green-10)" }}>
            <ShieldCheck size={14} />
            <Text size="1">{t("writing.compliance.allClear", "正文检测良好，未见违规与错字")}</Text>
          </Flex>
        )}
      </Flex>

      {/* 列表 */}
      <ScrollArea style={{ flex: 1, maxHeight: "340px", padding: "8px" }}>
        {matches.length === 0 ? (
          <Box p="4" style={{ textAlign: "center", color: "var(--gray-9)" }}>
            <Text size="2">
              {t("writing.compliance.cleanText", "当前章节文笔通畅，符合主要平台发布规范。")}
            </Text>
          </Box>
        ) : (
          <Flex direction="column" gap="2">
            {matches.map((m, idx) => (
              <Box
                key={`${m.from}-${m.to}-${idx}`}
                p="2"
                style={{
                  backgroundColor: "var(--gray-a2)",
                  borderRadius: "var(--radius-2)",
                  borderLeft: `3px solid ${
                    m.category === "prohibited"
                      ? "var(--red-9)"
                      : m.category === "warning"
                        ? "var(--amber-9)"
                        : "var(--blue-9)"
                  }`,
                  cursor: "pointer",
                }}
                onClick={() => handleJumpToMatch(m)}
              >
                <Flex justify="between" align="center">
                  <Flex align="center" gap="2">
                    <Text size="2" weight="bold">
                      「{m.word}」
                    </Text>
                    {m.category === "prohibited" ? (
                      <Badge color="red" size="1">高危违禁</Badge>
                    ) : m.category === "warning" ? (
                      <Badge color="amber" size="1">敏感警示</Badge>
                    ) : (
                      <Badge color="blue" size="1">错别字</Badge>
                    )}
                  </Flex>
                  <ChevronRight size={14} color="var(--gray-9)" />
                </Flex>

                <Text
                  size="1"
                  color="gray"
                  style={{ display: "block", marginTop: "4px", lineHeight: "1.3" }}
                >
                  {m.message}
                </Text>

                {m.replacement && (
                  <Flex justify="end" mt="2">
                    <Button
                      size="1"
                      variant="soft"
                      color="blue"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReplace(m);
                      }}
                    >
                      <Check size={12} />
                      替换为「{m.replacement}」
                    </Button>
                  </Flex>
                )}
              </Box>
            ))}
          </Flex>
        )}
      </ScrollArea>

      {/* 底部一键操作 */}
      {typoCount > 0 && (
        <Flex
          p="2"
          justify="end"
          style={{
            borderTop: "1px solid var(--gray-a4)",
            backgroundColor: "var(--color-surface)",
          }}
        >
          <Button size="1" variant="surface" color="blue" onClick={handleReplaceAllTypos}>
            一键修正全部错别字 ({typoCount})
          </Button>
        </Flex>
      )}
    </Box>
  );
}
