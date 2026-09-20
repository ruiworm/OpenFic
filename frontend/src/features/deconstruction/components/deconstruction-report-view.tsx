/**
 * 拆书分析报告展示面板
 */

import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  ScrollArea,
  Select,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import {
  BookPlus,
  Copy,
  Download,
  FileCheck2,
  FileSearch,
  History,
  Save,
  Share2,
  Sparkles,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { StreamingMarkdown, toast } from "@/components";
import { useProjects } from "@/features/projects/hooks/use-projects";

interface DeconstructionReportViewProps {
  title: string;
  sourceTitle: string;
  reportMarkdown: string;
  isStreaming: boolean;
  savedId?: string;
  onOpenCreateProject: () => void;
  onOpenHistory: () => void;
  onSaveReport: () => void;
  onExportToNote: (projectId: string) => void;
  isSaving: boolean;
}

const TOC_SECTIONS = [
  "【梗概】",
  "【人设】",
  "【世界观】",
  "【本文核心框架】",
  "【起承转合】",
  "【主角人物的情绪变化图】",
  "【男女主角的欲望目标】",
  "【本文核心冲突】",
  "【本文爽感爽点来源】",
  "【主角之间的感情线】",
  "【主角的事业线】",
  "【这篇文的反转剧情罗列】",
  "【结构大纲】",
];

export function DeconstructionReportView({
  title,
  sourceTitle,
  reportMarkdown,
  isStreaming,
  savedId,
  onOpenCreateProject,
  onOpenHistory,
  onSaveReport,
  onExportToNote,
  isSaving,
}: DeconstructionReportViewProps) {
  const { t } = useTranslation();
  const [noteExportOpen, setNoteExportOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const { data: projectsData } = useProjects();
  const projects = projectsData?.items ?? [];

  const handleCopy = async () => {
    if (!reportMarkdown) return;
    try {
      await navigator.clipboard.writeText(reportMarkdown);
      toast.success(t("deconstruction.copiedReport", "分析报告已复制到剪贴板"));
    } catch {
      toast.error(t("common.copyFailed", "复制失败"));
    }
  };

  const handleDownload = (format: "md" | "txt") => {
    if (!reportMarkdown) return;
    const blob = new Blob([reportMarkdown], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "小说深度拆解分析"}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("deconstruction.downloadSuccess", "导出成功"));
  };

  const handleConfirmExportToNote = () => {
    if (!selectedProjectId) return;
    onExportToNote(selectedProjectId);
    setNoteExportOpen(false);
  };

  const scrollToSection = (sectionTag: string) => {
    if (!contentContainerRef.current) return;
    const walker = document.createTreeWalker(
      contentContainerRef.current,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.nodeValue?.includes(sectionTag)) {
        const parentElem = node.parentElement;
        parentElem?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
    }
  };

  return (
    <Flex direction="column" style={{ height: "100%", background: "var(--color-background)" }}>
      {/* 顶部工具栏 */}
      <Flex
        align="center"
        justify="between"
        p="3"
        style={{
          borderBottom: "1px solid var(--gray-a4)",
          background: "var(--gray-a2)",
          flexShrink: 0,
        }}
      >
        <Flex align="center" gap="2">
          <Heading size="3">
            {title || t("deconstruction.defaultReportTitle", "小说深度拆解分析报告")}
          </Heading>
          {isStreaming ? (
            <Badge color="amber" variant="surface">
              <Sparkles size={12} className="animate-spin" />
              {t("deconstruction.statusAnalyzing", "正在深度拆解分析中...")}
            </Badge>
          ) : reportMarkdown ? (
            <Badge color="green" variant="surface">
              <FileCheck2 size={12} />
              {t("deconstruction.statusComplete", "分析已完成")}
            </Badge>
          ) : null}
        </Flex>

        <Flex align="center" gap="2">
          {reportMarkdown && (
            <>
              {/* 核心杀手级功能：一键转化为新书 */}
              <Button
                size="2"
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.35)",
                  color: "#ffffff",
                  fontWeight: 600,
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
                onClick={onOpenCreateProject}
                disabled={isStreaming}
              >
                <BookPlus size={15} />
                {t("deconstruction.createProjectBtn", "一键转化为新书 (仿写脚手架)")}
              </Button>

              {/* 归档到项目笔记 */}
              <Button
                size="2"
                variant="soft"
                color="gray"
                onClick={() => setNoteExportOpen(true)}
                disabled={isStreaming}
                style={{ borderRadius: "8px", cursor: "pointer" }}
              >
                <Share2 size={14} />
                {t("deconstruction.exportToNoteBtn", "归档到项目笔记")}
              </Button>

              {/* 保存报告到历史 */}
              <Tooltip content={t("deconstruction.saveReportTooltip", "保存报告至历史库")}>
                <Button
                  size="2"
                  variant="soft"
                  color="gray"
                  onClick={onSaveReport}
                  loading={isSaving}
                  disabled={isStreaming}
                  style={{ borderRadius: "8px", cursor: "pointer" }}
                >
                  <Save size={14} />
                  {savedId
                    ? t("deconstruction.savedBtn", "已保存")
                    : t("deconstruction.saveBtn", "保存")}
                </Button>
              </Tooltip>

              {/* 复制 */}
              <Tooltip content={t("common.copy", "复制全文")}>
                <Button
                  size="2"
                  variant="ghost"
                  color="gray"
                  onClick={handleCopy}
                  style={{ borderRadius: "8px", cursor: "pointer" }}
                >
                  <Copy size={14} />
                </Button>
              </Tooltip>

              {/* 下载导出 */}
              <Tooltip content={t("deconstruction.downloadMarkdown", "导出 Markdown 文件")}>
                <Button
                  size="2"
                  variant="ghost"
                  color="gray"
                  onClick={() => handleDownload("md")}
                  style={{ borderRadius: "8px", cursor: "pointer" }}
                >
                  <Download size={14} />
                </Button>
              </Tooltip>
            </>
          )}

          {/* 打开历史记录 */}
          <Button
            size="2"
            variant="soft"
            color="gray"
            onClick={onOpenHistory}
            style={{ borderRadius: "8px", cursor: "pointer" }}
          >
            <History size={14} />
            {t("deconstruction.historyBtn", "拆书历史")}
          </Button>
        </Flex>
      </Flex>

      {/* 22 维快速章节锚点导航栏 */}
      {reportMarkdown && (
        <Flex
          gap="2"
          px="3"
          py="2"
          align="center"
          style={{
            overflowX: "auto",
            borderBottom: "1px solid var(--gray-a3)",
            background: "var(--gray-a1)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <Text size="1" color="gray" weight="medium" style={{ flexShrink: 0 }}>
            {t("deconstruction.tocLabel", "章节直达：")}
          </Text>
          {TOC_SECTIONS.map((sec) => (
            <Button
              key={sec}
              size="1"
              variant="surface"
              color="gray"
              style={{
                fontSize: "11px",
                height: "24px",
                padding: "0 10px",
                borderRadius: "999px",
                cursor: "pointer",
              }}
              onClick={() => scrollToSection(sec)}
            >
              {sec.replace(/[【】]/g, "")}
            </Button>
          ))}
        </Flex>
      )}

      {/* 主展示区 */}
      <Box style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {reportMarkdown ? (
          <ScrollArea style={{ height: "100%" }}>
            <Box p="6" ref={contentContainerRef} className="deconstruction-markdown-wrapper">
              <StreamingMarkdown
                content={reportMarkdown}
                isStreaming={isStreaming}
              />
            </Box>
          </ScrollArea>
        ) : (
          <Flex
            direction="column"
            align="center"
            justify="center"
            style={{ height: "100%" }}
            p="6"
            gap="3"
          >
            <Box
              p="4"
              style={{
                borderRadius: "50%",
                background: "var(--accent-a3)",
                color: "var(--accent-9)",
              }}
            >
              <FileSearch size={40} />
            </Box>
            <Heading size="4" weight="bold">
              {t("deconstruction.emptyTitle", "深度透视爆款小说结构，一键构建仿写脚手架")}
            </Heading>
            <Text size="2" color="gray" align="center" style={{ maxWidth: "560px", lineHeight: 1.6 }}>
              {t(
                "deconstruction.emptyDesc",
                "在左侧输入您想要拆解借鉴的参考小说（支持全文、样章或 TXT 文件），AI 分析师将自动提取梗概、男女主人设、世界观规则、起承转合、情绪变化曲线、爽点来源与分卷章节大纲。\n\n分析完成后，可一键将提取的架构直接生成为您的全新小说项目，提笔即开写！",
              )}
            </Text>
          </Flex>
        )}
      </Box>

      {/* 归档到项目笔记的确认弹窗 */}
      <Dialog.Root open={noteExportOpen} onOpenChange={setNoteExportOpen}>
        <Dialog.Content maxWidth="450px">
          <Dialog.Title>{t("deconstruction.exportToNoteModalTitle", "归档到项目笔记")}</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            {t("deconstruction.exportToNoteModalDesc", "选择您已有的小说项目，拆书报告将作为一份参考资料笔记保存到该项目中。")}
          </Dialog.Description>

          <Flex direction="column" gap="3">
            <Box>
              <Text size="2" weight="medium" mb="1" style={{ display: "block" }}>
                {t("deconstruction.selectTargetProject", "选择目标小说项目")}
              </Text>
              <Select.Root value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <Select.Trigger placeholder={t("deconstruction.chooseProjectPlaceholder", "请选择项目...")} style={{ width: "100%" }} />
                <Select.Content>
                  {projects.map((p) => (
                    <Select.Item key={p.id} value={p.id}>
                      {p.title}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>

            <Flex justify="end" gap="3" mt="3">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  {t("common.cancel", "取消")}
                </Button>
              </Dialog.Close>
              <Button
                color="accent"
                disabled={!selectedProjectId}
                onClick={handleConfirmExportToNote}
              >
                {t("deconstruction.confirmExportBtn", "确定归档")}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}
