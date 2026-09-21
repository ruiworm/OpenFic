/**
 * 拆书工坊左侧输入面板
 */

import {
  Badge,
  Box,
  Button,
  Flex,
  Text,
  TextField,
  TextArea,
  Select,
  SegmentedControl,
  Tooltip,
} from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  KeyRound,
  Play,
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
    if (configuredProviders.length > 0) {
      const firstP = configuredProviders[0];
      const pModels = models.filter((m) => m.providerId === firstP.id);
      const firstM = pModels.length > 0 ? pModels[0] : getFallbackModels(firstP)[0];
      if (firstM) {
        return `${firstP.id}::${firstM.modelId || firstM.id}`;
      }
    }
    return "";
  }, [configuredProviders, models, selectedModelId, selectedProviderId, settings?.defaultModel]);

  // 同步初始化默认模型
  useEffect(() => {
    if (!selectedModelId && activeValue && activeValue.includes("::")) {
      const [pId, mId] = activeValue.split("::", 2);
      onProviderChange(pId);
      onModelChange(mId);
    }
  }, [activeValue, onModelChange, onProviderChange, selectedModelId]);

  const handleSelectChange = (val: string) => {
    if (val.includes("::")) {
      const [pId, mId] = val.split("::", 2);
      onProviderChange(pId);
      onModelChange(mId);
    } else {
      onModelChange(val);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onTextChange(content);
        if (!sourceTitle) {
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
          onSourceTitleChange(nameWithoutExt);
          if (!title) {
            onTitleChange(`《${nameWithoutExt}》深度拆解`);
          }
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".txt") || file.name.endsWith(".md"))) {
      handleFileUpload(file);
    }
  };

  const wordCount = text.length;

  return (
    <Flex direction="column" gap="3" style={{ height: "100%" }}>
      {/* 拆书标题与来源 */}
      <Box>
        <Flex gap="2">
          <Box style={{ flex: 1 }}>
            <Text size="1" color="gray" weight="medium" mb="1" style={{ display: "block" }}>
              {t("deconstruction.analysisTitle", "拆书任务名称")}
            </Text>
            <TextField.Root
              size="2"
              placeholder={t("deconstruction.analysisTitlePlaceholder", "例如：《某某小说》深度拆解")}
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              disabled={isStreaming}
            />
          </Box>
          <Box style={{ width: "160px" }}>
            <Text size="1" color="gray" weight="medium" mb="1" style={{ display: "block" }}>
              {t("deconstruction.sourceBookName", "原书名/篇名")}
            </Text>
            <TextField.Root
              size="2"
              placeholder={t("deconstruction.sourceBookPlaceholder", "例如：斗破苍穹")}
              value={sourceTitle}
              onChange={(e) => onSourceTitleChange(e.target.value)}
              disabled={isStreaming}
            />
          </Box>
        </Flex>
      </Box>

      {/* 模型选择与 API Key 配置状态 */}
      {configuredProviders.length === 0 ? (
        <Flex
          direction="column"
          gap="2"
          p="3"
          style={{
            background: "var(--amber-a2)",
            borderRadius: "8px",
            border: "1px dashed var(--amber-a6)",
          }}
        >
          <Flex align="center" justify="between" gap="2">
            <Flex align="center" gap="2">
              <AlertCircle size={15} color="var(--amber-10)" />
              <Text size="2" weight="bold" color="amber">
                {t("deconstruction.noApiKeyTitle", "尚未配置大模型 API Key")}
              </Text>
            </Flex>
            <Button
              size="1"
              color="amber"
              variant="solid"
              type="button"
              onClick={() => openSettings({ category: "connections" })}
            >
              <KeyRound size={13} />
              {t("deconstruction.configureApiKeyNow", "立即配置 API Key")}
            </Button>
          </Flex>
          <Text size="1" color="gray">
            {t(
              "deconstruction.noApiKeyDesc",
              "拆书深度分析需要调用大语言模型。支持 DeepSeek、OpenAI、Claude、硅基流动等任意服务商，点击按钮即可直接填入 API Key。",
            )}
          </Text>
        </Flex>
      ) : (
        <Flex align="center" justify="between" gap="2" wrap="wrap">
          <Flex align="center" gap="2" style={{ flex: 1, minWidth: 260 }}>
            <Text size="1" color="gray" weight="medium" style={{ flexShrink: 0 }}>
              {t("deconstruction.selectModel", "分析模型：")}
            </Text>
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
                        <Flex align="center" gap="1" style={{ color: "var(--indigo-11)", fontWeight: 600 }}>
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
                {t("deconstruction.manageApiKeyBtn", "管理 API Key")}
              </Button>
            </Tooltip>
          </Flex>

          <Badge
            variant="surface"
            color="indigo"
            size="2"
            style={{
              borderRadius: "8px",
              padding: "4px 8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Sparkles size={12} />
            {t("deconstruction.builtinPresetBadge", "22 维金牌小说拆解预设")}
          </Badge>
        </Flex>
      )}

      {/* 输入方式切换 */}
      <Flex justify="between" align="center">
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
              <Button size="1" variant="ghost" color="gray" onClick={onClear}>
                <Trash2 size={13} />
              </Button>
            </Tooltip>
          )}
        </Flex>
      </Flex>

      {/* 文本输入或拖拽区域 */}
      <Box style={{ flex: 1, minHeight: 220, position: "relative" }}>
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
            <Upload size={32} color="var(--accent-9)" />
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
      <Flex gap="2" pt="1">
        {isStreaming ? (
          <Button
            size="3"
            color="red"
            variant="solid"
            style={{ flex: 1 }}
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
            style={{ flex: 1 }}
            onClick={() => openSettings({ category: "connections" })}
          >
            <KeyRound size={16} />
            {t("deconstruction.configureApiKeyNow", "立即配置 API Key 后开始拆解")}
          </Button>
        ) : (
          <Button
            size="3"
            variant="solid"
            style={{ flex: 1 }}
            disabled={!text.trim()}
            onClick={onStartAnalysis}
          >
            <Play size={16} />
            <Sparkles size={16} />
            {t("deconstruction.startAnalysisBtn", "开始 22 维深度拆解")}
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
