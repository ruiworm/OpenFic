/**
 * 拆书工坊左侧输入面板
 */

import {
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
  Upload,
  Play,
  Square,
  Trash2,
  Settings2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchModels } from "@/features/settings/lib/model-api";
import { fetchSettings } from "@/features/settings/lib/settings-api";

interface DeconstructionInputPanelProps {
  title: string;
  onTitleChange: (v: string) => void;
  sourceTitle: string;
  onSourceTitleChange: (v: string) => void;
  text: string;
  onTextChange: (v: string) => void;
  selectedModelId: string;
  onModelChange: (v: string) => void;
  promptTemplate: string;
  onPromptTemplateChange: (v: string) => void;
  defaultPromptTemplate: string;
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
  promptTemplate,
  onPromptTemplateChange,
  defaultPromptTemplate,
  isStreaming,
  onStartAnalysis,
  onStopAnalysis,
  onClear,
}: DeconstructionInputPanelProps) {
  const { t } = useTranslation();
  const [inputTab, setInputTab] = useState<"paste" | "upload">("paste");
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取模型列表
  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: () => fetchModels(),
  });

  // 获取默认设置
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const activeModelId = selectedModelId || settings?.default_model || (models[0]?.id ?? "");

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

      {/* 模型选择与模板定制切换 */}
      <Flex align="center" justify="between" gap="2">
        <Flex align="center" gap="2" style={{ flex: 1, minWidth: 0 }}>
          <Text size="1" color="gray" weight="medium" style={{ flexShrink: 0 }}>
            {t("deconstruction.selectModel", "分析模型：")}
          </Text>
          <Select.Root
            size="2"
            value={activeModelId}
            onValueChange={onModelChange}
            disabled={isStreaming}
          >
            <Select.Trigger style={{ flex: 1, minWidth: 0 }} />
            <Select.Content>
              {models.map((m) => (
                <Select.Item key={m.id} value={m.id}>
                  {m.name || m.modelId} ({m.providerId})
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>

        <Button
          size="1"
          variant={showPromptSettings ? "solid" : "soft"}
          color={showPromptSettings ? "accent" : "gray"}
          onClick={() => setShowPromptSettings(!showPromptSettings)}
        >
          <Settings2 size={13} />
          {t("deconstruction.promptSettingsBtn", "拆书模板")}
        </Button>
      </Flex>

      {/* 展开的提示词模板自定义区 */}
      {showPromptSettings && (
        <Box
          p="2"
          style={{
            background: "var(--gray-a2)",
            borderRadius: "var(--radius-3)",
            border: "1px solid var(--gray-a4)",
          }}
        >
          <Flex justify="between" align="center" mb="1">
            <Text size="1" weight="bold">
              {t("deconstruction.customPromptTitle", "22 维小说拆解分析师提示词")}
            </Text>
            <Button
              size="1"
              variant="ghost"
              color="gray"
              onClick={() => onPromptTemplateChange(defaultPromptTemplate)}
            >
              <RotateCcw size={11} />
              {t("deconstruction.resetDefaultPrompt", "恢复默认模板")}
            </Button>
          </Flex>
          <TextArea
            size="1"
            rows={5}
            value={promptTemplate || defaultPromptTemplate}
            onChange={(e) => onPromptTemplateChange(e.target.value)}
            disabled={isStreaming}
          />
        </Box>
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
        ) : (
          <Button
            size="3"
            color="accent"
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
