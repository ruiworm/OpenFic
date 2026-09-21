/**
 * 拆书工坊左侧主控制面板 (新建拆解与历史报告双模式)
 */

import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  ScrollArea,
  SegmentedControl,
  Select,
  Text,
  TextArea,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  Clock,
  FileText,
  KeyRound,
  Play,
  Plus,
  ScanText,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppShell } from "@/features/app-shell/components/app-shell-context";
import { fetchModels, fetchProviders } from "@/features/settings/lib/model-api";
import { fetchSettings } from "@/features/settings/lib/settings-api";
import type { ModelProvider } from "@/lib/model.types";
import { formatRelativeTime } from "@/lib/time-utils";
import type { Deconstruction } from "@/types/deconstruction";

interface SimpleModelOption {
  id: string;
  modelId: string;
  name: string;
  contextLength?: number;
}

function getFallbackModels(provider: ModelProvider): SimpleModelOption[] {
  const pType = provider.providerType;
  if (pType === "deepseek") {
    return [
      { id: "deepseek-chat", modelId: "deepseek-chat", name: "DeepSeek-V3", contextLength: 128000 },
      { id: "deepseek-reasoner", modelId: "deepseek-reasoner", name: "DeepSeek-R1", contextLength: 128000 },
    ];
  }
  if (pType === "openai" || pType === "azure") {
    return [
      { id: "gpt-4o", modelId: "gpt-4o", name: "GPT-4o", contextLength: 128000 },
      { id: "gpt-4o-mini", modelId: "gpt-4o-mini", name: "GPT-4o mini", contextLength: 128000 },
    ];
  }
  if (pType === "anthropic") {
    return [
      { id: "claude-3-5-sonnet-20241022", modelId: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", contextLength: 200000 },
      { id: "claude-3-5-haiku-20241022", modelId: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", contextLength: 200000 },
    ];
  }
  if (pType === "google_genai") {
    return [
      { id: "gemini-1.5-pro", modelId: "gemini-1.5-pro", name: "Gemini 1.5 Pro", contextLength: 1000000 },
      { id: "gemini-1.5-flash", modelId: "gemini-1.5-flash", name: "Gemini 1.5 Flash", contextLength: 1000000 },
    ];
  }
  if (pType === "openrouter") {
    return [
      { id: "deepseek/deepseek-chat", modelId: "deepseek/deepseek-chat", name: "DeepSeek V3", contextLength: 128000 },
      { id: "anthropic/claude-3.5-sonnet", modelId: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", contextLength: 200000 },
    ];
  }
  return [
    { id: "default", modelId: "default", name: `${provider.name} 默认模型`, contextLength: 128000 },
  ];
}

interface DeconstructionInputPanelProps {
  title: string;
  onTitleChange: (v: string) => void;
  sourceTitle: string;
  onSourceTitleChange: (v: string) => void;
  text: string;
  onTextChange: (v: string) => void;
  selectedModelId: string;
  onModelChange: (v: string) => void;
  selectedProviderId: string;
  onProviderChange: (v: string) => void;
  isStreaming: boolean;
  onStartAnalysis: () => void;
  onStopAnalysis: () => void;
  onClear: () => void;

  // 模式切换与历史联动
  activeTab: "input" | "history";
  onActiveTabChange: (tab: "input" | "history") => void;
  selectedReportId?: string;
  onSelectReport: (report: Deconstruction) => void;
  historyItems?: Deconstruction[];
  isHistoryLoading?: boolean;
  onDeleteReport?: (id: string) => void;
  historySearch?: string;
  onHistorySearchChange?: (v: string) => void;
}

export function DeconstructionInputPanel({
  title,
  onTitleChange,
  sourceTitle,
  onSourceTitleChange,
  text,
  onTextChange,
  selectedModelId,
  onModelChange,
  selectedProviderId,
  onProviderChange,
  isStreaming,
  onStartAnalysis,
  onStopAnalysis,
  onClear,
  activeTab,
  onActiveTabChange,
  selectedReportId,
  onSelectReport,
  historyItems = [],
  isHistoryLoading = false,
  onDeleteReport,
  historySearch = "",
  onHistorySearchChange,
}: DeconstructionInputPanelProps) {
  const { t } = useTranslation();
  const { openSettings } = useAppShell();
  const [inputTab, setInputTab] = useState<"paste" | "upload">("paste");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取用户配置的所有服务商（有 API Key 的外部服务商）
  const { data: providers = [] } = useQuery({
    queryKey: ["model-providers"],
    queryFn: fetchProviders,
  });

  const configuredProviders = useMemo(
    () => providers.filter((p) => !p.isBuiltin),
    [providers],
  );

  // 获取所有 LLM 模型
  const { data: models = [] } = useQuery({
    queryKey: ["models", "llm"],
    queryFn: () => fetchModels(undefined, "llm"),
  });

  // 获取全局默认设置
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  // 计算当前激活的复合选项值 (provider_id::model_id)
  const activeValue = useMemo(() => {
    if (selectedProviderId && selectedModelId) {
      return `${selectedProviderId}::${selectedModelId}`;
    }
    if (selectedModelId) {
      for (const p of configuredProviders) {
        const pModels = models.filter((m) => m.providerId === p.id);
        const matched = pModels.find((m) => m.id === selectedModelId || m.modelId === selectedModelId);
        if (matched) {
          return `${p.id}::${matched.modelId || matched.id}`;
        }
      }
    }
    // 优先采用系统设置中的默认模型
    if (settings?.defaultModel) {
      for (const p of configuredProviders) {
        const pModels = models.filter((m) => m.providerId === p.id);
        const matched = pModels.find(
          (m) => m.id === settings.defaultModel || m.modelId === settings.defaultModel,
        );
        if (matched) {
          return `${p.id}::${matched.modelId || matched.id}`;
        }
      }
    }
    // 默认选用第一个已配置的服务商首个模型
    if (configuredProviders.length > 0) {
      const p = configuredProviders[0];
      const pModels = models.filter((m) => m.providerId === p.id);
      const fallbackList = pModels.length > 0 ? pModels : getFallbackModels(p);
      const first = fallbackList[0];
      const mId = "modelId" in first && first.modelId ? first.modelId : first.id;
      return `${p.id}::${mId}`;
    }
    return "";
  }, [configuredProviders, models, selectedModelId, selectedProviderId, settings?.defaultModel]);

  // 当选项变更时，同步回传 selectedProviderId 与 selectedModelId
  useEffect(() => {
    if (activeValue && (!selectedProviderId || !selectedModelId)) {
      const [pId, mId] = activeValue.split("::");
      if (pId && mId) {
        onProviderChange(pId);
        onModelChange(mId);
      }
    }
  }, [activeValue, onModelChange, onProviderChange, selectedModelId, selectedProviderId]);

  const handleSelectChange = (compositeValue: string) => {
    const [pId, mId] = compositeValue.split("::");
    if (pId && mId) {
      onProviderChange(pId);
      onModelChange(mId);
    }
  };

  // 处理文件读取
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onTextChange(content);
        if (!sourceTitle) {
          const rawName = file.name.replace(/\.[^/.]+$/, "");
          setDerivedBookName(rawName);
        }
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const setDerivedBookName = (rawName: string) => {
    onSourceTitleChange(rawName);
    if (!title) {
      onTitleChange(`《${rawName}》深度拆解分析`);
    }
  };

  const wordCount = text.length;

  return (
    <Box className="deconstruction-left-panel">
      {/* 统一顶栏 */}
      <Box className="deconstruction-left-header">
        <Flex justify="between" align="center" mb="2">
          <Flex align="center" gap="2">
            <ScanText size={18} color="var(--accent-9)" />
            <Heading size="3" weight="bold">
              {t("topbar.deconstruction", "拆书仿写")}
            </Heading>
          </Flex>
        </Flex>

        {/* 模式切换 SegmentedControl */}
        <SegmentedControl.Root
          size="2"
          value={activeTab}
          onValueChange={(v) => onActiveTabChange(v as "input" | "history")}
          style={{ width: "100%" }}
        >
          <SegmentedControl.Item value="input">
            <Flex align="center" gap="1">
              <Plus size={14} />
              <span>{t("deconstruction.tabNew", "新建拆解")}</span>
            </Flex>
          </SegmentedControl.Item>
          <SegmentedControl.Item value="history">
            <Flex align="center" gap="1">
              <BookOpen size={14} />
              <span>
                {t("deconstruction.tabHistory", "历史报告")}
                {historyItems.length > 0 && ` (${historyItems.length})`}
              </span>
            </Flex>
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      </Box>

      {/* 视图内容切换 */}
      {activeTab === "input" ? (
        <Box className="deconstruction-left-body">
          {/* 原著与标题设定 */}
          <Flex direction="column" gap="2">
            <Flex gap="2">
              <Box style={{ flex: 1 }}>
                <Text as="label" size="1" color="gray" weight="medium" mb="1" style={{ display: "block" }}>
                  {t("deconstruction.sourceBookName", "原书名/篇名")}
                </Text>
                <TextField.Root
                  size="2"
                  value={sourceTitle}
                  onChange={(e) => setDerivedBookName(e.target.value)}
                  placeholder={t("deconstruction.sourceBookPlaceholder", "例如：斗破苍穹")}
                  disabled={isStreaming}
                />
              </Box>
              <Box style={{ flex: 1.2 }}>
                <Text as="label" size="1" color="gray" weight="medium" mb="1" style={{ display: "block" }}>
                  {t("deconstruction.analysisTitle", "拆解任务名称")}
                </Text>
                <TextField.Root
                  size="2"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder={t("deconstruction.analysisTitlePlaceholder", "例如：《某某小说》深度拆解")}
                  disabled={isStreaming}
                />
              </Box>
            </Flex>
          </Flex>

          {/* 分析模型选择 */}
          {configuredProviders.length === 0 ? (
            <Flex
              direction="column"
              p="3"
              gap="2"
              style={{
                borderRadius: "var(--radius-3)",
                border: "1px solid var(--amber-a6)",
                background: "var(--amber-a2)",
              }}
            >
              <Flex align="center" gap="2">
                <AlertCircle size={16} color="var(--amber-10)" />
                <Text size="2" weight="bold" color="amber">
                  {t("deconstruction.noApiKeyTitle", "尚未配置大模型 API Key")}
                </Text>
              </Flex>
              <Text size="1" color="gray" style={{ lineHeight: 1.5 }}>
                {t(
                  "deconstruction.noApiKeyDesc",
                  "拆书深度分析需要调用大语言模型。支持 DeepSeek、OpenAI、Claude、硅基流动等任意服务商，点击按钮即可直接填入 API Key。",
                )}
              </Text>
              <Button
                size="2"
                variant="solid"
                color="amber"
                onClick={() => openSettings({ category: "connections" })}
                style={{ alignSelf: "flex-start", marginTop: 4 }}
              >
                <KeyRound size={14} />
                {t("deconstruction.configureApiKeyNow", "立即配置 API Key")}
              </Button>
            </Flex>
          ) : (
            <Flex direction="column" gap="2">
              <Text size="1" color="gray" weight="medium">
                {t("deconstruction.selectModel", "分析模型：")}
              </Text>
              <Flex gap="2" align="center">
                <Select.Root
                  size="2"
                  value={activeValue}
                  onValueChange={handleSelectChange}
                  disabled={isStreaming}
                >
                  <Select.Trigger style={{ flex: 1, minWidth: 0 }} />
                  <Select.Content>
                    {configuredProviders.map((provider) => {
                      const pModels = models.filter((m) => m.providerId === provider.id);
                      const displayModels = pModels.length > 0 ? pModels : getFallbackModels(provider);
                      return (
                        <Select.Group key={provider.id}>
                          <Select.Label>
                            <Flex align="center" gap="1" style={{ color: "var(--accent-11)", fontWeight: 600 }}>
                              <KeyRound size={12} />
                              <span>
                                {provider.name} ({t("deconstruction.configuredKeyBadge", "已配置 API Key")})
                              </span>
                            </Flex>
                          </Select.Label>
                          {displayModels.map((m) => {
                            const mId = m.modelId || m.id;
                            const itemValue = `${provider.id}::${mId}`;
                            const ctx = m.contextLength ? ` (${Math.round(m.contextLength / 1000)}k)` : "";
                            return (
                              <Select.Item key={itemValue} value={itemValue}>
                                {m.name || mId}{ctx}
                              </Select.Item>
                            );
                          })}
                        </Select.Group>
                      );
                    })}
                  </Select.Content>
                </Select.Root>
                <Tooltip content={t("deconstruction.manageApiKeyTip", "配置或管理您的模型服务商与 API Key")}>
                  <Button
                    size="2"
                    variant="surface"
                    color="gray"
                    type="button"
                    onClick={() => openSettings({ category: "connections" })}
                    disabled={isStreaming}
                    style={{ flexShrink: 0 }}
                  >
                    <KeyRound size={13} />
                    {t("deconstruction.manageApiKeyBtn", "管理 Key")}
                  </Button>
                </Tooltip>
              </Flex>

              <Badge
                variant="surface"
                color="indigo"
                size="1"
                style={{
                  borderRadius: "var(--radius-2)",
                  padding: "4px 8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  alignSelf: "flex-start",
                }}
              >
                <Sparkles size={11} />
                {t("deconstruction.builtinPresetBadge", "22 维金牌小说拆解预设")}
              </Badge>
            </Flex>
          )}

          {/* 输入方式切换 */}
          <Flex justify="between" align="center" pt="1">
            <SegmentedControl.Root
              size="1"
              value={inputTab}
              onValueChange={(v) => setInputTab(v as "paste" | "upload")}
            >
              <SegmentedControl.Item value="paste">
                {t("deconstruction.tabPaste", "文本粘贴")}
              </SegmentedControl.Item>
              <SegmentedControl.Item value="upload">
                {t("deconstruction.tabUpload", "文件导入")}
              </SegmentedControl.Item>
            </SegmentedControl.Root>

            <Flex align="center" gap="2">
              <Text size="1" color={wordCount > 50000 ? "amber" : "gray"}>
                {wordCount.toLocaleString()} {t("common.chars", "字")}
                {wordCount > 50000 && ` (${t("deconstruction.longContextTip", "长文建议选用大上下文模型")})`}
              </Text>
              {text && !isStreaming && (
                <Tooltip content={t("common.clear", "清空文本")}>
                  <IconButton size="1" variant="ghost" color="gray" onClick={onClear}>
                    <Trash2 size={13} />
                  </IconButton>
                </Tooltip>
              )}
            </Flex>
          </Flex>

          {/* 文本输入或拖拽区域 */}
          <Box style={{ flex: 1, minHeight: 200, position: "relative" }}>
            {inputTab === "paste" ? (
              <TextArea
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                placeholder={t(
                  "deconstruction.textPlaceholder",
                  "在此粘贴待拆解的小说全文、样章或段落。\n\nAI 将根据专业分析师 22 维结构模型（梗概、人设、世界观、起承转合、情绪变化图、男女主欲望目标、核心冲突、爽点来源、反转剧情、结构大纲等）执行全维度深度剖析。",
                )}
                style={{
                  height: "100%",
                  width: "100%",
                  resize: "none",
                  fontFamily: "var(--font-code, monospace)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
                disabled={isStreaming}
              />
            ) : (
              <Flex
                direction="column"
                align="center"
                justify="center"
                gap="2"
                p="6"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  height: "100%",
                  border: "2px dashed var(--gray-a6)",
                  borderRadius: "var(--radius-3)",
                  background: "var(--gray-a2)",
                  cursor: "pointer",
                }}
              >
                <Upload size={28} color="var(--accent-9)" />
                <Text size="2" weight="medium">
                  {t("deconstruction.dropzoneTitle", "拖拽 .txt 或 .md 文件到此处，或点击选择")}
                </Text>
                <Text size="1" color="gray">
                  {t("deconstruction.dropzoneDesc", "支持任意小说文本文件，自动解析并载入")}
                </Text>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </Flex>
            )}
          </Box>

          {/* 底部启动与控制按钮 */}
          <Flex gap="2" pt="2" style={{ flexShrink: 0 }}>
            {isStreaming ? (
              <Button
                size="3"
                color="red"
                variant="solid"
                style={{ flex: 1, cursor: "pointer" }}
                onClick={onStopAnalysis}
              >
                <Square size={16} />
                {t("deconstruction.stopBtn", "停止生成")}
              </Button>
            ) : configuredProviders.length === 0 ? (
              <Button
                size="3"
                color="amber"
                variant="soft"
                style={{ flex: 1, cursor: "pointer" }}
                onClick={() => openSettings({ category: "connections" })}
              >
                <KeyRound size={16} />
                {t("deconstruction.configureApiKeyNow", "立即配置 API Key 后开始拆解")}
              </Button>
            ) : (
              <Button
                size="3"
                variant="solid"
                style={{ flex: 1, cursor: "pointer" }}
                disabled={!text.trim()}
                onClick={onStartAnalysis}
              >
                <Play size={16} />
                <Sparkles size={16} />
                {t("deconstruction.startAnalysisBtn", "开始 22 维深度拆解")}
              </Button>
            )}
          </Flex>
        </Box>
      ) : (
        /* 历史拆解报告模式 */
        <Flex direction="column" style={{ flex: 1, minHeight: 0 }}>
          <Box p="3" style={{ borderBottom: "1px solid var(--gray-a4)" }}>
            <TextField.Root
              size="2"
              placeholder={t("deconstruction.searchHistoryPlaceholder", "按标题或原书名搜索...")}
              value={historySearch}
              onChange={(e) => onHistorySearchChange?.(e.target.value)}
            >
              <TextField.Slot>
                <Search size={14} color="var(--gray-9)" />
              </TextField.Slot>
            </TextField.Root>
          </Box>

          <ScrollArea style={{ flex: 1 }}>
            <Box className="deconstruction-history-list">
              {isHistoryLoading ? (
                <Flex align="center" justify="center" p="6">
                  <Text size="2" color="gray">
                    {t("common.loading", "加载中...")}
                  </Text>
                </Flex>
              ) : historyItems.length === 0 ? (
                <Flex direction="column" align="center" justify="center" p="6" gap="2">
                  <FileText size={32} color="var(--gray-7)" />
                  <Text size="2" color="gray">
                    {t("deconstruction.noHistory", "暂无历史拆书报告")}
                  </Text>
                  <Button
                    size="2"
                    variant="soft"
                    onClick={() => onActiveTabChange("input")}
                    style={{ marginTop: 8 }}
                  >
                    <Plus size={14} />
                    {t("deconstruction.startFirstAnalysis", "开启首次拆解")}
                  </Button>
                </Flex>
              ) : (
                historyItems.map((item) => {
                  const isSelected = item.id === selectedReportId;
                  return (
                    <Box
                      key={item.id}
                      className={`deconstruction-history-card ${isSelected ? "deconstruction-history-card--active" : ""}`}
                      onClick={() => onSelectReport(item)}
                    >
                      <Flex justify="between" align="start">
                        <Box style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                          <Text size="2" weight="bold" style={{ display: "block" }}>
                            {item.title}
                          </Text>
                          {item.source_title && (
                            <Flex align="center" gap="1" mt="1">
                              <BookOpen size={12} color="var(--accent-9)" />
                              <Text size="1" color="gray">
                                {item.source_title}
                              </Text>
                            </Flex>
                          )}
                          <Flex align="center" gap="3" mt="2">
                            <Flex align="center" gap="1">
                              <Clock size={11} color="var(--gray-8)" />
                              <Text size="1" color="gray">
                                {formatRelativeTime(item.created_at)}
                              </Text>
                            </Flex>
                            <Text size="1" color="gray">
                              {item.source_word_count.toLocaleString()} 字
                            </Text>
                          </Flex>
                        </Box>

                        {onDeleteReport && (
                          <Tooltip content={t("common.delete", "删除")}>
                            <IconButton
                              size="1"
                              variant="ghost"
                              color="gray"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteReport(item.id);
                              }}
                            >
                              <Trash2 size={13} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Flex>
                    </Box>
                  );
                })
              )}
            </Box>
          </ScrollArea>

          <Box p="3" style={{ borderTop: "1px solid var(--gray-a4)" }}>
            <Button
              size="2"
              variant="soft"
              style={{ width: "100%", cursor: "pointer" }}
              onClick={() => onActiveTabChange("input")}
            >
              <Plus size={14} />
              {t("deconstruction.newDeconstruction", "新建拆解任务")}
            </Button>
          </Box>
        </Flex>
      )}
    </Box>
  );
}
