import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Flex,
  Text,
  Badge,
  Button,
  TextField,
  TextArea,
  Select,
  SegmentedControl,
  Card,
  Spinner,
  Separator,
  Callout,
} from "@radix-ui/themes";
import {
  Sparkles,
  Rocket,
  Copy,
  BookOpen,
  Check,
  Flame,
  Lightbulb,
  Compass,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/components/toast";
import { fetchModels, fetchProviders } from "@/features/settings/lib/model-api";
import { fetchSettings } from "@/features/settings/lib/settings-api";
import { useCreateProject } from "@/features/projects/hooks/use-projects";
import { useGenerateTopic } from "../hooks/use-market";
import type { TopicSuggestion, MarketBookDetail } from "../types/market.types";

interface TopicIncubatorProps {
  initialBook?: MarketBookDetail | null;
}

export function TopicIncubator({ initialBook }: TopicIncubatorProps) {
  const navigate = useNavigate();

  // 表单状态
  const [channel, setChannel] = useState<string>("male");
  const [genre, setGenre] = useState<string>("都市脑洞");
  const [referenceNovel, setReferenceNovel] = useState<string>("");
  const [customAngle, setCustomAngle] = useState<string>("");

  // 模型选择
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [selectedProviderId] = useState<string>("");

  // 生成结果与交互状态
  const [proposals, setProposals] = useState<TopicSuggestion[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isCreatingIndex, setIsCreatingIndex] = useState<number | null>(null);

  // 初始化来自外部传入的书籍
  useEffect(() => {
    if (initialBook) {
      setChannel(initialBook.channel);
      setGenre(initialBook.category);
      setReferenceNovel(initialBook.title);
      setCustomAngle(`沿用《${initialBook.title}》的核心驱动力与快节奏留存逻辑，做金手指反套路微创新`);
    }
  }, [initialBook]);

  // 获取模型与提供商
  const { data: providers = [] } = useQuery({
    queryKey: ["model-providers"],
    queryFn: fetchProviders,
  });

  const configuredProviders = useMemo(
    () => providers.filter((p) => !p.isBuiltin),
    [providers]
  );

  const { data: models = [] } = useQuery({
    queryKey: ["models", "llm"],
    queryFn: () => fetchModels(undefined, "llm"),
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  // 默认模型初始化
  useEffect(() => {
    if (!selectedModelId && settings?.defaultModel) {
      setSelectedModelId(settings.defaultModel);
    }
  }, [settings, selectedModelId]);

  // AI 孵化 mutation
  const topicMutation = useGenerateTopic();
  const createProjectMutation = useCreateProject();

  const handleGenerate = async () => {
    try {
      const res = await topicMutation.mutateAsync({
        genre,
        category: genre,
        channel,
        reference_novel: referenceNovel.trim() || undefined,
        custom_angle: customAngle.trim() || undefined,
        model_id: selectedModelId || undefined,
        provider_id: selectedProviderId || undefined,
      });
      const generated = res.suggestions || res.proposals || [];
      setProposals(generated);
      toast.success("AI 爆款选题孵化完成！为您生成 3 套高胜率立项案");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "请检查网络或模型配置";
      toast.error(`选题生成失败: ${msg}`);
    }
  };

  const handleCopyProposal = (prop: TopicSuggestion, idx: number) => {
    const hook = prop.hook ?? prop.one_sentence_hook;
    const contrast = prop.character_contrast ?? prop.protagonist_setup;
    const markdown =
      `# 《${prop.title}》网文新书选题策划案\n\n` +
      `**核心一句话钩子**：${hook}\n\n` +
      `**金手指设定与爽点机制**：\n${prop.golden_finger}\n\n` +
      `**反差人设**：\n${contrast}\n\n` +
      `**黄金前三章节奏拆解**：\n${prop.three_chapter_rhythm}\n\n` +
      `**扫榜大盘市场逻辑**：\n${prop.market_logic}\n`;

    void navigator.clipboard.writeText(markdown);
    setCopiedIndex(idx);
    toast.success("选题案内容已复制到剪贴板");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCreateProject = async (prop: TopicSuggestion, idx: number) => {
    try {
      setIsCreatingIndex(idx);
      const hook = prop.hook ?? prop.one_sentence_hook;
      const contrast = prop.character_contrast ?? prop.protagonist_setup;
      const desc =
        `【核心钩子】${hook}\n\n` +
        `【金手指与爽点】${prop.golden_finger}\n\n` +
        `【反差人设】${contrast}\n\n` +
        `【黄金前三章节奏】${prop.three_chapter_rhythm}\n\n` +
        `【大盘市场逻辑】${prop.market_logic}`;

      const newProj = await createProjectMutation.mutateAsync({
        title: prop.title,
        description: desc,
      });

      toast.success(`新书《${prop.title}》创建成功！正在进入写作工作台...`);
      navigate(`/projects/${newProj.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "未知错误";
      toast.error(`创建项目失败: ${msg}`);
    } finally {
      setIsCreatingIndex(null);
    }
  };

  return (
    <Box>
      {/* 顶部引导说明 */}
      <Callout.Root color="indigo" variant="surface" style={{ marginBottom: 16 }}>
        <Callout.Icon>
          <Compass size={18} />
        </Callout.Icon>
        <Callout.Text size="2">
          <strong>网文爆款孵化逻辑：</strong> 扫榜不是抄书名，而是通过
          <strong style={{ color: "var(--indigo-11)" }}>「真实留存好书 + 核心爽点反差 + 黄金三章快节奏钩子」</strong>
          进行精准微创新。选择心仪赛道或对标神作，AI 将为您生成差异化极高且契合市场留存痛点的全新书案。
        </Callout.Text>
      </Callout.Root>

      {/* 选题配置主卡片 */}
      <Card
        variant="surface"
        style={{
          padding: 20,
          borderRadius: 12,
          border: "1px solid var(--gray-a4)",
          background: "var(--color-surface)",
          marginBottom: 24,
        }}
      >
        <Flex direction="column" gap="4">
          <Flex justify="between" align="center" wrap="wrap" gap="3">
            <Flex align="center" gap="2">
              <Lightbulb size={18} color="var(--amber-9)" />
              <Text size="3" weight="bold">
                定制你的新书孵化方向
              </Text>
            </Flex>

            {/* 频道选择 */}
            <SegmentedControl.Root
              size="2"
              value={channel}
              onValueChange={setChannel}
            >
              <SegmentedControl.Item value="male">男频爆款主线</SegmentedControl.Item>
              <SegmentedControl.Item value="female">女频红文情感</SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>

          <Separator size="4" />

          {/* 表单字段 */}
          <Flex direction="column" gap="3">
            <Flex gap="4" wrap="wrap">
              {/* 题材赛道 */}
              <Box style={{ flex: 1, minWidth: 200 }}>
                <Text size="2" weight="medium" style={{ display: "block", marginBottom: 6 }}>
                  目标题材赛道
                </Text>
                <Select.Root size="2" value={genre} onValueChange={setGenre}>
                  <Select.Trigger style={{ width: "100%" }} />
                  <Select.Content>
                    <Select.Item value="都市脑洞">都市脑洞 (规则怪谈/反转系统/苟道)</Select.Item>
                    <Select.Item value="玄幻脑洞">玄幻脑洞 (反派逆袭/魔道卧底/截胡)</Select.Item>
                    <Select.Item value="战神赘婿">战神赘婿 (身份反转/护国战神/打脸)</Select.Item>
                    <Select.Item value="悬疑怪谈">悬疑怪谈 (民俗恐怖/密室求生/推理)</Select.Item>
                    <Select.Item value="古言种田">古言种田 (全家读心/抄家流放/发家)</Select.Item>
                    <Select.Item value="现言甜宠">现言甜宠 (先婚后爱/双向奔赴/救赎)</Select.Item>
                    <Select.Item value="快穿系统">快穿系统 (拯救反派/白月光/爽文)</Select.Item>
                    <Select.Item value="宫斗宅斗">宫斗宅斗 (真假千金/重生复仇/权谋)</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>

              {/* 对标参考书籍 */}
              <Box style={{ flex: 2, minWidth: 260 }}>
                <Text size="2" weight="medium" style={{ display: "block", marginBottom: 6 }}>
                  对标榜首参考作（选填）
                </Text>
                <TextField.Root
                  size="2"
                  placeholder="例如：《我在精神病院学斩神》、《夫人你马甲又掉了》"
                  value={referenceNovel}
                  onChange={(e) => setReferenceNovel(e.target.value)}
                >
                  <TextField.Slot>
                    <BookOpen size={14} color="var(--gray-9)" />
                  </TextField.Slot>
                </TextField.Root>
              </Box>
            </Flex>

            {/* 微创新构想与特定反差点 */}
            <Box>
              <Text size="2" weight="medium" style={{ display: "block", marginBottom: 6 }}>
                核心微创新亮点 / 个人灵感偏好（选填）
              </Text>
              <TextArea
                rows={2}
                placeholder="例如：把传统的系统换成‘只要说谎就会被成真’；主角表面是懦弱社恐但脑回路清奇；反转一定要快，开局前两章就要解决首个恶性困境..."
                value={customAngle}
                onChange={(e) => setCustomAngle(e.target.value)}
              />
            </Box>

            {/* 模型配置与生成按钮 */}
            <Flex justify="between" align="center" wrap="wrap" gap="3" pt="2">
              <Flex align="center" gap="2" wrap="wrap">
                <Text size="2" color="gray">
                  分析模型：
                </Text>
                {configuredProviders.length > 0 ? (
                  <Select.Root
                    size="2"
                    value={selectedModelId || undefined}
                    onValueChange={setSelectedModelId}
                  >
                    <Select.Trigger style={{ minWidth: 160 }} />
                    <Select.Content>
                      {models.map((m) => (
                        <Select.Item key={m.id} value={m.id}>
                          {m.name || m.id}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                ) : (
                  <Badge color="gray" variant="surface">
                    系统默认内建引擎 (DeepSeek/智能兜底)
                  </Badge>
                )}
              </Flex>

              <Button
                variant="solid"
                color="indigo"
                size="3"
                onClick={handleGenerate}
                loading={topicMutation.isPending}
              >
                <Sparkles size={16} />
                一键智能孵化 3 套高胜率立项方案
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </Card>

      {/* 生成结果展示区域 */}
      {topicMutation.isPending ? (
        <Card variant="surface" style={{ padding: 48, textAlign: "center" }}>
          <Flex direction="column" align="center" gap="3">
            <Spinner size="3" />
            <Text size="3" weight="bold">
              AI 正在穿透网文大盘留存规律，结合黄金三章节奏推演爆款方案...
            </Text>
            <Text size="2" color="gray">
              正在解构开局冲突、人设反差魅力与核心金手指机制
            </Text>
          </Flex>
        </Card>
      ) : proposals.length > 0 ? (
        <Flex direction="column" gap="4">
          <Flex justify="between" align="center">
            <Flex align="center" gap="2">
              <Flame size={20} color="var(--orange-9)" />
              <Text size="4" weight="bold">
                为您生成的 3 套差异化选题方案
              </Text>
            </Flex>
            <Text size="2" color="gray">
              方案已结合题材大盘换手率与读者弃书止损心理设计
            </Text>
          </Flex>

          <Flex direction="column" gap="4">
            {proposals.map((prop, idx) => {
              const hook = prop.hook ?? prop.one_sentence_hook;
              const contrast = prop.character_contrast ?? prop.protagonist_setup;

              return (
                <Card
                  key={idx}
                  variant="surface"
                  style={{
                    padding: 22,
                    borderRadius: 12,
                    border: "1px solid var(--gray-a4)",
                    background: "var(--color-surface)",
                    position: "relative",
                    boxShadow: "0 2px 8px var(--gray-a2)",
                  }}
                >
                  <Flex direction="column" gap="3">
                    {/* 方案标题与核心钩子 */}
                    <Flex justify="between" align="start" wrap="wrap" gap="2">
                      <Box>
                        <Flex align="center" gap="2">
                          <Badge size="2" color={idx === 0 ? "orange" : idx === 1 ? "blue" : "purple"} variant="solid">
                            方案 0{idx + 1}
                          </Badge>
                          <Text size="4" weight="bold" style={{ color: "var(--gray-12)" }}>
                            《{prop.title}》
                          </Text>
                        </Flex>
                        <Box
                          style={{
                            marginTop: 8,
                            padding: "8px 12px",
                            background: "var(--accent-a2)",
                            borderLeft: "3px solid var(--accent-9)",
                            borderRadius: 4,
                          }}
                        >
                          <Text size="2" weight="bold" color="indigo">
                            🎯 一句话核心钩子：{hook}
                          </Text>
                        </Box>
                      </Box>

                      {/* 操作按钮 */}
                      <Flex align="center" gap="2">
                        <Button
                          variant="soft"
                          size="2"
                          color="gray"
                          onClick={() => handleCopyProposal(prop, idx)}
                        >
                          {copiedIndex === idx ? <Check size={14} color="var(--green-9)" /> : <Copy size={14} />}
                          {copiedIndex === idx ? "已复制" : "复制方案"}
                        </Button>
                        <Button
                          variant="solid"
                          size="2"
                          color="green"
                          loading={isCreatingIndex === idx}
                          onClick={() => void handleCreateProject(prop, idx)}
                        >
                          <Rocket size={14} />
                          一键开启新书创作
                        </Button>
                      </Flex>
                    </Flex>

                    <Separator size="4" />

                    {/* 详细设定网格 */}
                    <Box
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: 16,
                        fontSize: "0.875rem",
                      }}
                    >
                      {/* 金手指设定 */}
                      <Box style={{ background: "var(--gray-a2)", padding: 12, borderRadius: 8 }}>
                        <Text size="1" weight="bold" color="indigo" style={{ display: "block", marginBottom: 4 }}>
                          ⚡ 核心金手指与爽点机制
                        </Text>
                        <Text size="2" style={{ color: "var(--gray-12)", lineHeight: 1.6 }}>
                          {prop.golden_finger}
                        </Text>
                      </Box>

                      {/* 人设反差 */}
                      <Box style={{ background: "var(--gray-a2)", padding: 12, borderRadius: 8 }}>
                        <Text size="1" weight="bold" color="pink" style={{ display: "block", marginBottom: 4 }}>
                          🎭 人设与反差魅力
                        </Text>
                        <Text size="2" style={{ color: "var(--gray-12)", lineHeight: 1.6 }}>
                          {contrast}
                        </Text>
                      </Box>
                    </Box>

                    {/* 黄金前三章节奏拆解 */}
                    <Box style={{ background: "var(--gray-a2)", padding: 14, borderRadius: 8 }}>
                      <Text size="1" weight="bold" color="orange" style={{ display: "block", marginBottom: 6 }}>
                        🔥 黄金前三章节奏拆解 (开局即战场)
                      </Text>
                      <Text size="2" style={{ color: "var(--gray-12)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                        {prop.three_chapter_rhythm}
                      </Text>
                    </Box>

                    {/* 大盘市场逻辑 */}
                    <Box style={{ background: "var(--accent-a1)", padding: 12, borderRadius: 8 }}>
                      <Text size="1" weight="bold" color="indigo" style={{ display: "block", marginBottom: 4 }}>
                        📊 扫榜大盘市场逻辑 (为什么能火)
                      </Text>
                      <Text size="2" color="gray" style={{ lineHeight: 1.6 }}>
                        {prop.market_logic}
                      </Text>
                    </Box>
                  </Flex>
                </Card>
              );
            })}
          </Flex>
        </Flex>
      ) : null}
    </Box>
  );
}
