import { useState } from "react";
import {
  Dialog,
  Flex,
  Box,
  Text,
  Badge,
  Button,
  SegmentedControl,
  Tabs,
  ScrollArea,
  Separator,
  Card,
} from "@radix-ui/themes";
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Sparkles,
  BookOpen,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import { ResponsiveLine } from "@nivo/line";
import { useNavigate } from "react-router";
import { useMarketBookDetail } from "../hooks/use-market";
import type { ChapterBrief, MarketBookDetail } from "../types/market.types";

interface BookTrendDrawerProps {
  bookId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectForTopic?: (book: MarketBookDetail) => void;
}

export function BookTrendDrawer({
  bookId,
  open,
  onOpenChange,
  onSelectForTopic,
}: BookTrendDrawerProps) {
  const navigate = useNavigate();
  const { data: book, isLoading } = useMarketBookDetail(bookId);
  const [timeRange, setTimeRange] = useState<"7d" | "30d">("7d");
  const [activeChapterTab, setActiveChapterTab] = useState<string>("ch1");

  if (!open) return null;

  const rawTrends =
    timeRange === "7d"
      ? book?.history_trends_7d ?? book?.trend_7d ?? []
      : book?.history_trends_30d ?? book?.trend_30d ?? [];

  // 格式化图表数据
  const chartData = [
    {
      id: "在读人数",
      data: rawTrends.map((d) => ({
        x: d.date.slice(5), // MM-DD
        y: d.in_read_count ?? d.read_count,
      })),
    },
  ];

  const currentReadCount = book ? (book.in_read_count ?? book.read_count) : 0;
  const delta7d = book ? (book.delta_7d ?? book.gain_7d) : 0;
  const status = book ? (book.lifecycle_status ?? book.status) : "surging";

  // 走势与健康度诊断文案
  const renderDiagnosis = () => {
    switch (status) {
      case "surging":
        return {
          icon: <Flame size={16} color="var(--orange-9)" />,
          color: "orange" as const,
          title: "强劲爆发期 · 真实爆款",
          desc: "近7天在读净增显著，读者次留与翻页率极高。开篇抓人且主线推进果断，强烈推荐拆解其前三章爽点与金手指节奏！",
        };
      case "fake_spike":
        return {
          icon: <ShieldAlert size={16} color="var(--red-9)" />,
          color: "red" as const,
          title: "疑似虚火 / 买量突刺",
          desc: "前期通过大推买量或强行曝光冲高，但在读留存呈断崖式下跌，读者弃书率高。切勿盲目模仿其表面书名，需警惕核心剧情乏力。",
        };
      case "stable":
        return {
          icon: <CheckCircle2 size={16} color="var(--green-9)" />,
          color: "green" as const,
          title: "稳定长销期 · 沉淀口碑",
          desc: "在读波动平缓，受众粘性高，连载节奏成熟，读者粘度和完读率基底扎实，适合研究其世界观构筑与长线人设立体度。",
        };
      case "declining":
      default:
        return {
          icon: <TrendingDown size={16} color="var(--gray-9)" />,
          color: "gray" as const,
          title: "衰退减速期 · 题材边际收缩",
          desc: "在读指标逐步下行，可能面临中后期剧情同质化或核心矛盾消耗。关注其前期爆点，但需提防中后期灌水陷阱。",
        };
    }
  };

  const diagnosis = renderDiagnosis();

  // 一键跳转到拆书仿写页面并填充前三章
  const handleJumpToDeconstruct = () => {
    if (!book) return;
    const chapters = book.sample_chapters || [];
    const combinedChapters = chapters
      .map((ch) => `### 第${ch.chapter_num ?? ch.chapter_index}章 ${ch.title}\n\n${ch.content}`)
      .join("\n\n---\n\n");

    navigate("/deconstruction", {
      state: {
        title: `《${book.title}》前三章深度拆解`,
        sourceTitle: book.title,
        text: combinedChapters,
      },
    });
    onOpenChange(false);
  };

  const handleJumpToTopic = () => {
    if (!book) return;
    if (onSelectForTopic) {
      onSelectForTopic(book);
    }
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        style={{
          maxWidth: 820,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: "24px",
          gap: "16px",
          overflow: "hidden",
        }}
      >
        {isLoading || !book ? (
          <Flex align="center" justify="center" style={{ height: 400 }}>
            <Text color="gray">正在穿透抓取该作品全量留存与正文数据...</Text>
          </Flex>
        ) : (
          <>
            {/* 头部书籍基本信息 */}
            <Flex justify="between" align="start" gap="4">
              <Flex gap="3" align="start">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    style={{
                      width: 64,
                      height: 86,
                      borderRadius: 6,
                      objectFit: "cover",
                      border: "1px solid var(--gray-a4)",
                    }}
                  />
                ) : (
                  <Box
                    style={{
                      width: 64,
                      height: 86,
                      borderRadius: 6,
                      background: "var(--accent-3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <BookOpen size={24} color="var(--accent-9)" />
                  </Box>
                )}

                <Box>
                  <Flex align="center" gap="2" wrap="wrap">
                    <Dialog.Title style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                      《{book.title}》
                    </Dialog.Title>
                    <Badge color={book.channel === "male" ? "blue" : "pink"} variant="soft">
                      {book.channel === "male" ? "男频" : "女频"} · {book.category}
                    </Badge>
                    {book.is_debut && (
                      <Badge color="orange" variant="solid">
                        首秀新书
                      </Badge>
                    )}
                  </Flex>

                  <Text size="2" color="gray" style={{ marginTop: 4, display: "block" }}>
                    作者：{book.author} · 平台：{book.platform ?? "番茄小说"} · 连载字数：{(book.word_count / 10000).toFixed(1)}万字
                  </Text>

                  <Flex gap="1" style={{ marginTop: 6 }} wrap="wrap">
                    {book.tags.map((t: string) => (
                      <Badge key={t} size="1" variant="surface" color="gray">
                        #{t}
                      </Badge>
                    ))}
                  </Flex>
                </Box>
              </Flex>

              {/* 核心数据胶囊 */}
              <Card
                variant="surface"
                style={{
                  padding: "8px 16px",
                  background: "var(--gray-a2)",
                  minWidth: 160,
                  textAlign: "right",
                }}
              >
                <Text size="1" color="gray" weight="medium">
                  实时在读人数
                </Text>
                <Text size="5" weight="bold" color="red" style={{ display: "block", lineHeight: 1.2 }}>
                  {currentReadCount >= 10000
                    ? `${(currentReadCount / 10000).toFixed(1)}万`
                    : currentReadCount.toLocaleString()}
                </Text>
                <Flex align="center" justify="end" gap="1" style={{ marginTop: 4 }}>
                  {delta7d >= 0 ? (
                    <TrendingUp size={13} color="var(--green-9)" />
                  ) : (
                    <TrendingDown size={13} color="var(--red-9)" />
                  )}
                  <Text size="1" weight="medium" color={delta7d >= 0 ? "green" : "red"}>
                    7天 {delta7d >= 0 ? `+${(delta7d / 10000).toFixed(1)}万` : `${(delta7d / 10000).toFixed(1)}万`}
                  </Text>
                </Flex>
              </Card>
            </Flex>

            <Separator size="4" />

            {/* 中间可滚动区域 */}
            <ScrollArea style={{ flex: 1, paddingRight: 8 }} type="hover">
              <Flex direction="column" gap="4">
                {/* 走势诊断卡片 */}
                {diagnosis && (
                  <Card
                    style={{
                      borderLeft: `4px solid var(--${diagnosis.color}-9)`,
                      background: `var(--${diagnosis.color}-a2)`,
                    }}
                  >
                    <Flex gap="2" align="start">
                      {diagnosis.icon}
                      <Box>
                        <Text size="2" weight="bold" color={diagnosis.color}>
                          {diagnosis.title}
                        </Text>
                        <Text size="2" style={{ display: "block", marginTop: 2, color: "var(--gray-12)" }}>
                          {diagnosis.desc}
                        </Text>
                      </Box>
                    </Flex>
                  </Card>
                )}

                {/* 流量留存趋势图 */}
                <Card variant="surface" style={{ padding: 16 }}>
                  <Flex justify="between" align="center" mb="2">
                    <Flex align="center" gap="2">
                      <BarChart3 size={16} color="var(--accent-9)" />
                      <Text size="2" weight="bold">
                        真实在读与留存走势追踪
                      </Text>
                    </Flex>
                    <SegmentedControl.Root
                      size="1"
                      value={timeRange}
                      onValueChange={(v) => setTimeRange(v as "7d" | "30d")}
                    >
                      <SegmentedControl.Item value="7d">近 7 天</SegmentedControl.Item>
                      <SegmentedControl.Item value="30d">近 30 天</SegmentedControl.Item>
                    </SegmentedControl.Root>
                  </Flex>

                  <Box style={{ height: 220, width: "100%", position: "relative" }}>
                    {rawTrends.length > 0 ? (
                      <ResponsiveLine
                        data={chartData}
                        margin={{ top: 20, right: 24, bottom: 32, left: 60 }}
                        xScale={{ type: "point" }}
                        yScale={{
                          type: "linear",
                          min: "auto",
                          max: "auto",
                          stacked: false,
                        }}
                        curve="monotoneX"
                        axisTop={null}
                        axisRight={null}
                        axisBottom={{
                          tickSize: 0,
                          tickPadding: 8,
                        }}
                        axisLeft={{
                          tickSize: 0,
                          tickPadding: 8,
                          format: (val) => `${Number(val) / 10000}万`,
                        }}
                        colors={["var(--accent-9)"]}
                        lineWidth={3}
                        enablePoints={rawTrends.length <= 10}
                        pointSize={6}
                        pointColor="var(--accent-9)"
                        pointBorderWidth={2}
                        pointBorderColor="var(--color-background)"
                        enableArea={true}
                        areaOpacity={0.15}
                        useMesh={true}
                        theme={{
                          axis: {
                            ticks: {
                              text: {
                                fill: "var(--gray-10)",
                                fontSize: 11,
                              },
                            },
                          },
                          grid: {
                            line: {
                              stroke: "var(--gray-a3)",
                              strokeDasharray: "4 4",
                            },
                          },
                        }}
                      />
                    ) : (
                      <Flex align="center" justify="center" style={{ height: "100%" }}>
                        <Text size="2" color="gray">
                          暂无走势历史数据
                        </Text>
                      </Flex>
                    )}
                  </Box>
                  <Text size="1" color="gray" style={{ display: "block", marginTop: 4, textAlign: "right" }}>
                    * 数据基于番茄/起点公开在读指标每日定时抓取与差值核验
                  </Text>
                </Card>

                {/* 前三章正文预览 */}
                <Card variant="surface" style={{ padding: 16 }}>
                  <Flex align="center" gap="2" mb="3">
                    <BookOpen size={16} color="var(--accent-9)" />
                    <Text size="2" weight="bold">
                      黄金前三章正文透视（开篇即战场）
                    </Text>
                  </Flex>

                  {book.sample_chapters && book.sample_chapters.length > 0 ? (
                    <Tabs.Root value={activeChapterTab} onValueChange={setActiveChapterTab}>
                      <Tabs.List size="1">
                        {book.sample_chapters.map((ch: ChapterBrief, idx: number) => (
                          <Tabs.Trigger key={ch.chapter_index ?? idx} value={`ch${idx + 1}`}>
                            第{ch.chapter_num ?? ch.chapter_index}章 ({ch.word_count}字)
                          </Tabs.Trigger>
                        ))}
                      </Tabs.List>

                      {book.sample_chapters.map((ch: ChapterBrief, idx: number) => (
                        <Tabs.Content key={ch.chapter_index ?? idx} value={`ch${idx + 1}`} style={{ marginTop: 12 }}>
                          <Box
                            style={{
                              background: "var(--gray-a2)",
                              borderRadius: 8,
                              padding: 16,
                              maxHeight: 280,
                              overflowY: "auto",
                              fontSize: "0.875rem",
                              lineHeight: 1.8,
                              color: "var(--gray-12)",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            <Text weight="bold" size="3" style={{ display: "block", marginBottom: 8 }}>
                              {ch.title}
                            </Text>
                            {ch.content}
                          </Box>
                        </Tabs.Content>
                      ))}
                    </Tabs.Root>
                  ) : (
                    <Text size="2" color="gray">
                      暂无公开前三章正文预览
                    </Text>
                  )}
                </Card>
              </Flex>
            </ScrollArea>

            {/* 底部功能按钮 */}
            <Flex justify="end" gap="3" pt="2" style={{ borderTop: "1px solid var(--gray-a4)" }}>
              <Button variant="soft" color="gray" onClick={() => onOpenChange(false)}>
                关闭
              </Button>
              <Button
                variant="surface"
                color="indigo"
                onClick={handleJumpToTopic}
              >
                <Sparkles size={15} />
                基于此书孵化选题
              </Button>
              <Button
                variant="solid"
                color="red"
                onClick={handleJumpToDeconstruct}
              >
                <ExternalLink size={15} />
                一键 AI 拆解前三章 (转到拆书仿写)
              </Button>
            </Flex>
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
