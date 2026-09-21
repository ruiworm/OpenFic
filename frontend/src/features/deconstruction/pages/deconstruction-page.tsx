/**
 * 拆书工坊主页面 (对齐全站 UI 规范与弹性拖拽分栏)
 */

import { Box, Flex, Heading, SegmentedControl } from "@radix-ui/themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useLocation, useNavigate } from "react-router";

import { PanelLayoutLoading, toast } from "@/components";
import { MobileAppSidebarTrigger, useAppShell } from "@/features/app-shell";
import { usePersistedPanelLayout } from "@/hooks/use-persisted-panel-layout";
import type { Deconstruction } from "@/types/deconstruction";

import { CreateProjectDialog } from "../components/create-project-dialog";
import { DeconstructionInputPanel } from "../components/deconstruction-input-panel";
import { DeconstructionReportView } from "../components/deconstruction-report-view";
import {
  useCreateProjectFromDeconstruction,
  useDeconstructionHistory,
  useDeleteDeconstruction,
  useExportDeconstructionToNote,
  useSaveDeconstruction,
} from "../hooks/use-deconstruction";
import { streamDeconstruction } from "../lib/deconstruction-api";

import "./deconstruction-page.css";

const PANEL_LAYOUT_KEY = "panel-layout.deconstruction";
const PANEL_IDS = ["deconstruction-left", "deconstruction-right"] as const;

export function DeconstructionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useAppShell();

  // 本地表单与分析状态
  const [title, setTitle] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [text, setText] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [reportMarkdown, setReportMarkdown] = useState("");

  // 监听来自网文大盘扫榜等外部路由跳转传入的正文和书名
  useEffect(() => {
    const state = location.state as { title?: string; sourceTitle?: string; text?: string } | null;
    if (state?.text) {
      if (state.title) setTitle(state.title);
      if (state.sourceTitle) setSourceTitle(state.sourceTitle);
      setText(state.text);
      setLeftTab("input");
      navigate(".", { replace: true, state: {} });
    }
  }, [location.state, navigate]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>(undefined);

  // 左侧面板模式：新建拆解 vs 历史库
  const [leftTab, setLeftTab] = useState<"input" | "history">("input");
  const [historySearch, setHistorySearch] = useState("");

  // 移动端视图切换：输入 vs 报告
  const [mobileActiveTab, setMobileActiveTab] = useState<"input" | "report">("input");

  // 对话框状态
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // 持久化拖拽面板尺寸
  const panelLayout = usePersistedPanelLayout(PANEL_LAYOUT_KEY, PANEL_IDS, !isMobile);

  // 数据服务与变更 Hooks
  const { data: historyData, isLoading: isHistoryLoading } = useDeconstructionHistory(historySearch);
  const deleteMutation = useDeleteDeconstruction();
  const saveMutation = useSaveDeconstruction();
  const createProjectMutation = useCreateProjectFromDeconstruction();
  const exportNoteMutation = useExportDeconstructionToNote();

  const historyItems = historyData?.items ?? [];

  // 开始深度拆解分析
  const handleStartAnalysis = useCallback(() => {
    if (!text.trim()) return;

    setIsStreaming(true);
    setReportMarkdown("");
    setSavedId(undefined);

    // 移动端自动切至报告视图
    if (isMobile) {
      setMobileActiveTab("report");
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulated = "";

    void streamDeconstruction(
      {
        text: text.trim(),
        model_id: selectedModelId || undefined,
        provider_id: selectedProviderId || undefined,
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
  }, [isMobile, selectedModelId, selectedProviderId, sourceTitle, t, text, title]);

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

  // 从历史记录载入报告
  const handleSelectReport = (report: Deconstruction) => {
    setTitle(report.title);
    setSourceTitle(report.source_title);
    setText(report.source_text || "");
    setReportMarkdown(report.report_markdown);
    setSelectedModelId(report.model_id);
    setSavedId(report.id);

    if (isMobile) {
      setMobileActiveTab("report");
    }
  };

  // 删除历史报告
  const handleDeleteReport = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      if (savedId === id) {
        setSavedId(undefined);
      }
      toast.success(t("common.deleteSuccess", "已成功删除该拆书报告"));
    } catch {
      toast.error(t("common.deleteFailed", "删除失败"));
    }
  };

  // 保存当前拆书报告
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

  // 归档到已有项目笔记
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

  if (!isMobile && !panelLayout.isLoaded) {
    return <PanelLayoutLoading />;
  }

  const leftContent = (
    <DeconstructionInputPanel
      title={title}
      onTitleChange={setTitle}
      sourceTitle={sourceTitle}
      onSourceTitleChange={setSourceTitle}
      text={text}
      onTextChange={setText}
      selectedModelId={selectedModelId}
      onModelChange={setSelectedModelId}
      selectedProviderId={selectedProviderId}
      onProviderChange={setSelectedProviderId}
      isStreaming={isStreaming}
      onStartAnalysis={handleStartAnalysis}
      onStopAnalysis={handleStopAnalysis}
      onClear={handleClear}
      activeTab={leftTab}
      onActiveTabChange={setLeftTab}
      selectedReportId={savedId}
      onSelectReport={handleSelectReport}
      historyItems={historyItems}
      isHistoryLoading={isHistoryLoading}
      onDeleteReport={handleDeleteReport}
      historySearch={historySearch}
      onHistorySearchChange={setHistorySearch}
    />
  );

  const rightContent = (
    <DeconstructionReportView
      title={title}
      sourceTitle={sourceTitle}
      reportMarkdown={reportMarkdown}
      isStreaming={isStreaming}
      savedId={savedId}
      onOpenCreateProject={() => setCreateProjectOpen(true)}
      onOpenHistory={() => setLeftTab("history")}
      onSaveReport={handleSaveReport}
      onExportToNote={handleExportToNote}
      isSaving={saveMutation.isPending}
    />
  );

  return (
    <Box className="deconstruction-page">
      {!isMobile ? (
        /* 桌面端：标准 Resizable 双栏 */
        <Group
          orientation="horizontal"
          className="deconstruction-page-body"
          defaultLayout={panelLayout.defaultLayout}
          onLayoutChanged={panelLayout.onLayoutChanged}
        >
          <Panel
            id="deconstruction-left"
            defaultSize={35}
            minSize={25}
            maxSize={55}
            collapsible={false}
          >
            <Box className="deconstruction-panel">{leftContent}</Box>
          </Panel>

          <Separator className="resize-handle deconstruction-page-separator" />

          <Panel id="deconstruction-right" minSize={40}>
            <Box className="deconstruction-panel">{rightContent}</Box>
          </Panel>
        </Group>
      ) : (
        /* 移动端：标准顶栏 + 选项卡平滑切换 */
        <Flex className="deconstruction-page-body" direction="column">
          <Flex
            align="center"
            justify="between"
            className="deconstruction-page-mobile-topbar"
          >
            <Flex align="center" gap="2">
              <MobileAppSidebarTrigger />
              <Heading size="3">
                {t("topbar.deconstruction", "拆书仿写")}
              </Heading>
            </Flex>

            <SegmentedControl.Root
              size="1"
              value={mobileActiveTab}
              onValueChange={(v) => setMobileActiveTab(v as "input" | "report")}
            >
              <SegmentedControl.Item value="input">
                {t("deconstruction.mobileTabInput", "输入/历史")}
              </SegmentedControl.Item>
              <SegmentedControl.Item value="report">
                {t("deconstruction.mobileTabReport", "分析报告")}
              </SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>

          <Box style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            {mobileActiveTab === "input" ? leftContent : rightContent}
          </Box>
        </Flex>
      )}

      {/* 转化为新书弹窗 */}
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        defaultTitle={sourceTitle ? `《${sourceTitle}》仿写创作` : "新小说仿写创作"}
        defaultDescription=""
        loading={createProjectMutation.isPending}
        onSubmit={handleConfirmCreateProject}
      />
    </Box>
  );
}
