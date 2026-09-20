/**
 * 拆书工坊主页面 (Book Deconstruction Workshop)
 */

import { Box } from "@radix-ui/themes";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { toast } from "@/components";
import { CreateProjectDialog } from "../components/create-project-dialog";
import { DeconstructionHistoryDrawer } from "../components/deconstruction-history-drawer";
import { DeconstructionInputPanel } from "../components/deconstruction-input-panel";
import { DeconstructionReportView } from "../components/deconstruction-report-view";
import {
  useCreateProjectFromDeconstruction,
  useExportDeconstructionToNote,
  useSaveDeconstruction,
} from "../hooks/use-deconstruction";
import { streamDeconstruction } from "../lib/deconstruction-api";
import type { Deconstruction } from "@/types/deconstruction";

import "./deconstruction-page.css";

export function DeconstructionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 本地表单与分析状态
  const [title, setTitle] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [text, setText] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [reportMarkdown, setReportMarkdown] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>(undefined);

  // 对话框状态
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Mutations
  const saveMutation = useSaveDeconstruction();
  const createProjectMutation = useCreateProjectFromDeconstruction();
  const exportNoteMutation = useExportDeconstructionToNote();

  // 开始分析
  const handleStartAnalysis = useCallback(() => {
    if (!text.trim()) return;

    setIsStreaming(true);
    setReportMarkdown("");
    setSavedId(undefined);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulated = "";

    void streamDeconstruction(
      {
        text: text.trim(),
        model_id: selectedModelId || undefined,
        title: title || undefined,
        source_title: sourceTitle || undefined,
      },
      {
        onChunk: (chunk) => {
          accumulated += chunk;
          setReportMarkdown(accumulated);
        },
        onDone: () => {
          setIsStreaming(false);
          abortControllerRef.current = null;
          toast.success(t("deconstruction.analysisCompleteToast", "拆书深度分析完成！"));
        },
        onError: (err) => {
          setIsStreaming(false);
          abortControllerRef.current = null;
          toast.error(`${t("deconstruction.analysisErrorToast", "分析失败: ")} ${err.message}`);
        },
      },
      controller.signal,
    );
  }, [selectedModelId, sourceTitle, text, title, t]);

  // 停止分析
  const handleStopAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    toast.info(t("deconstruction.analysisStopped", "已停止生成"));
  }, [t]);

  // 清空输入
  const handleClear = useCallback(() => {
    setText("");
    setTitle("");
    setSourceTitle("");
  }, []);

  // 保存分析报告
  const handleSaveReport = async () => {
    if (!reportMarkdown) return;
    try {
      const saved = await saveMutation.mutateAsync({
        title: title || `《${sourceTitle || "未知作品"}》深度拆解`,
        source_title: sourceTitle,
        source_preview: text.slice(0, 300),
        source_word_count: text.length,
        source_text: text,
        model_id: selectedModelId,
        report_markdown: reportMarkdown,
      });
      setSavedId(saved.id);
      toast.success(t("deconstruction.saveSuccessToast", "拆书报告已保存至历史库"));
    } catch {
      toast.error(t("common.saveFailed", "保存失败"));
    }
  };

  // 一键转化为新书项目
  const handleConfirmCreateProject = async (
    projectTitle: string,
    projectDescription: string,
  ) => {
    try {
      let targetId = savedId;
      // 如果尚未保存，先自动保存入库
      if (!targetId) {
        const saved = await saveMutation.mutateAsync({
          title: title || `《${sourceTitle || "未知作品"}》深度拆解`,
          source_title: sourceTitle,
          source_preview: text.slice(0, 300),
          source_word_count: text.length,
          source_text: text,
          model_id: selectedModelId,
          report_markdown: reportMarkdown,
        });
        targetId = saved.id;
        setSavedId(targetId);
      }

      const res = await createProjectMutation.mutateAsync({
        id: targetId,
        data: {
          title: projectTitle,
          description: projectDescription,
        },
      });

      setCreateProjectOpen(false);
      toast.success(t("deconstruction.createProjectSuccess", "已为您生成新书与仿写脚手架！"));
      navigate(`/projects/${res.project_id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t("common.actionFailed", "操作失败: ")} ${msg}`);
    }
  };

  // 归档到项目笔记
  const handleExportToNote = async (targetProjectId: string) => {
    try {
      let targetId = savedId;
      if (!targetId) {
        const saved = await saveMutation.mutateAsync({
          title: title || `《${sourceTitle || "未知作品"}》深度拆解`,
          source_title: sourceTitle,
          source_preview: text.slice(0, 300),
          source_word_count: text.length,
          source_text: text,
          model_id: selectedModelId,
          report_markdown: reportMarkdown,
        });
        targetId = saved.id;
        setSavedId(targetId);
      }

      await exportNoteMutation.mutateAsync({
        id: targetId,
        data: { project_id: targetProjectId },
      });
      toast.success(t("deconstruction.exportToNoteSuccess", "已成功归档到该项目笔记中！"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t("common.actionFailed", "操作失败: ")} ${msg}`);
    }
  };

  // 从历史记录加载
  const handleSelectReport = (report: Deconstruction) => {
    setTitle(report.title);
    setSourceTitle(report.source_title);
    setText(report.source_text || "");
    setReportMarkdown(report.report_markdown);
    setSelectedModelId(report.model_id);
    setSavedId(report.id);
  };

  return (
    <Box className="deconstruction-page">
      {/* 左侧控制与输入区 */}
      <Box className="deconstruction-page__left">
        <DeconstructionInputPanel
          title={title}
          onTitleChange={setTitle}
          sourceTitle={sourceTitle}
          onSourceTitleChange={setSourceTitle}
          text={text}
          onTextChange={setText}
          selectedModelId={selectedModelId}
          onModelChange={setSelectedModelId}
          isStreaming={isStreaming}
          onStartAnalysis={handleStartAnalysis}
          onStopAnalysis={handleStopAnalysis}
          onClear={handleClear}
        />
      </Box>

      {/* 右侧分析与仿写看板区 */}
      <Box className="deconstruction-page__right">
        <DeconstructionReportView
          title={title}
          sourceTitle={sourceTitle}
          reportMarkdown={reportMarkdown}
          isStreaming={isStreaming}
          savedId={savedId}
          onOpenCreateProject={() => setCreateProjectOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          onSaveReport={handleSaveReport}
          onExportToNote={handleExportToNote}
          isSaving={saveMutation.isPending}
        />
      </Box>

      {/* 转化为新书弹窗 */}
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        defaultTitle={sourceTitle ? `《${sourceTitle}》仿写创作` : "新小说仿写创作"}
        defaultDescription=""
        loading={createProjectMutation.isPending}
        onSubmit={handleConfirmCreateProject}
      />

      {/* 历史记录抽屉 */}
      <DeconstructionHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onSelectReport={handleSelectReport}
      />
    </Box>
  );
}
