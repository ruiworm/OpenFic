import { useState, useMemo } from "react";
import {
  Box,
  Flex,
  Text,
  Badge,
  Button,
  TextField,
  Select,
  SegmentedControl,
  Card,
  Spinner,
  Tooltip,
} from "@radix-ui/themes";
import {
  TrendingUp,
  TrendingDown,
  Flame,
  BookOpen,
  Search,
  ShieldAlert,
  CheckCircle2,
  BarChart3,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useMarketRankings, useSyncMarket } from "../hooks/use-market";
import { BookTrendDrawer } from "./book-trend-drawer";
import type { MarketBook, MarketBookDetail } from "../types/market.types";

interface NovelRankingsListProps {
  onSelectForTopic?: (book: MarketBookDetail) => void;
  initialCategory?: string;
}

export function NovelRankingsList({
  onSelectForTopic,
  initialCategory,
}: NovelRankingsListProps) {
  const [channel, setChannel] = useState<string>("all");
  const [category, setCategory] = useState<string>(initialCategory || "all");
  const [sortBy, setSortBy] = useState<string>("read_count");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 抽屉弹窗状态
  const [drawerBookId, setDrawerBookId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 获取榜单数据
  const { data: ranksData, isLoading, refetch } = useMarketRankings({
    channel: channel === "all" ? undefined : channel,
    category: category === "all" ? undefined : category,
    sort_by: sortBy,
    limit: 50,
  });

  // 手动同步
  const syncMutation = useSyncMarket();

  const handleSync = async () => {
    await syncMutation.mutateAsync();
    void refetch();
  };

  // 本地搜索过滤
  const filteredBooks = useMemo(() => {
    if (!ranksData?.items) return [];
    if (!searchQuery.trim()) return ranksData.items;

    const q = searchQuery.trim().toLowerCase();
    return ranksData.items.filter(
      (b: MarketBook) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.tags.some((t: string) => t.toLowerCase().includes(q))
    );
  }, [ranksData?.items, searchQuery]);

  const openDrawer = (bookId: string) => {
    setDrawerBookId(bookId);
    setIsDrawerOpen(true);
  };

  const getLifecycleBadge = (status: MarketBook["status"] | undefined) => {
    switch (status) {
      case "surging":
        return (
          <Badge color="orange" variant="soft">
            <Flame size={12} style={{ marginRight: 3 }} /> 飙升爆发
          </Badge>
        );
      case "fake_spike":
        return (
          <Badge color="red" variant="soft">
            <ShieldAlert size={12} style={{ marginRight: 3 }} /> 疑似虚火/买量
          </Badge>
        );
      case "stable":
        return (
          <Badge color="green" variant="soft">
            <CheckCircle2 size={12} style={{ marginRight: 3 }} /> 稳定长销
          </Badge>
        );
      case "declining":
      default:
        return (
          <Badge color="gray" variant="soft">
            <TrendingDown size={12} style={{ marginRight: 3 }} /> 走势平缓
          </Badge>
        );
    }
  };

  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return { bg: "#f59e0b", color: "#ffffff", border: "#d97706" };
    if (rank === 2) return { bg: "#94a3b8", color: "#ffffff", border: "#64748b" };
    if (rank === 3) return { bg: "#b45309", color: "#ffffff", border: "#92400e" };
    return { bg: "var(--gray-a3)", color: "var(--gray-11)", border: "var(--gray-a5)" };
  };

  return (
    <Box>
      {/* 筛选过滤工具条 */}
      <Card
        variant="surface"
        style={{
          padding: "16px",
          marginBottom: "16px",
          background: "var(--color-surface)",
          borderRadius: 10,
          border: "1px solid var(--gray-a4)",
        }}
      >
        <Flex direction="column" gap="3">
          {/* 第一行：频道分类与榜单模式切换 */}
          <Flex justify="between" align="center" wrap="wrap" gap="3">
            <Flex align="center" gap="3" wrap="wrap">
              {/* 男频 / 女频 / 全部 */}
              <SegmentedControl.Root
                size="2"
                value={channel}
                onValueChange={setChannel}
              >
                <SegmentedControl.Item value="all">全站频道</SegmentedControl.Item>
                <SegmentedControl.Item value="male">男频爆款</SegmentedControl.Item>
                <SegmentedControl.Item value="female">女频红文</SegmentedControl.Item>
              </SegmentedControl.Root>

              {/* 榜单排行模式 */}
              <SegmentedControl.Root
                size="2"
                value={sortBy}
                onValueChange={setSortBy}
              >
                <SegmentedControl.Item value="read_count">
                  真实在读总榜
                </SegmentedControl.Item>
                <SegmentedControl.Item value="surging">
                  🚀 7天飙升榜
                </SegmentedControl.Item>
                <SegmentedControl.Item value="dark_horse">
                  ⚡ 黑马新人榜
                </SegmentedControl.Item>
                <SegmentedControl.Item value="debut">
                  🌟 每日首秀新书
                </SegmentedControl.Item>
              </SegmentedControl.Root>
            </Flex>

            {/* 刷新与同步 */}
            <Flex align="center" gap="2">
              <Button
                variant="outline"
                size="2"
                onClick={() => void handleSync()}
                loading={syncMutation.isPending}
              >
                <RefreshCw size={14} className={syncMutation.isPending ? "animate-spin" : ""} />
                全网大盘刷新
              </Button>
            </Flex>
          </Flex>

          {/* 第二行：分类细筛与关键词搜索 */}
          <Flex justify="between" align="center" wrap="wrap" gap="3">
            <Flex align="center" gap="2" wrap="wrap">
              <SlidersHorizontal size={14} color="var(--gray-9)" />
              <Text size="1" color="gray" weight="bold">
                题材赛道：
              </Text>
              <Select.Root size="2" value={category} onValueChange={setCategory}>
                <Select.Trigger style={{ minWidth: 140 }} />
                <Select.Content>
                  <Select.Item value="all">全部分类题材</Select.Item>
                  <Select.Item value="都市脑洞">都市脑洞</Select.Item>
                  <Select.Item value="玄幻脑洞">玄幻脑洞</Select.Item>
                  <Select.Item value="战神赘婿">战神赘婿</Select.Item>
                  <Select.Item value="悬疑怪谈">悬疑怪谈</Select.Item>
                  <Select.Item value="古言种田">古言种田</Select.Item>
                  <Select.Item value="现言甜宠">现言甜宠</Select.Item>
                  <Select.Item value="快穿系统">快穿系统</Select.Item>
                  <Select.Item value="宫斗宅斗">宫斗宅斗</Select.Item>
                </Select.Content>
              </Select.Root>
            </Flex>

            {/* 搜索框 */}
            <Box style={{ width: 280 }}>
              <TextField.Root
                size="2"
                placeholder="搜索书名、作者或关键词..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              >
                <TextField.Slot>
                  <Search size={14} color="var(--gray-9)" />
                </TextField.Slot>
              </TextField.Root>
            </Box>
          </Flex>
        </Flex>
      </Card>

      {/* 榜单书籍列表 */}
      {isLoading ? (
        <Flex align="center" justify="center" style={{ height: 260 }}>
          <Spinner size="3" />
          <Text size="2" color="gray" ml="2">
            正在穿透抓取各题材榜单及在读留存数据...
          </Text>
        </Flex>
      ) : filteredBooks.length === 0 ? (
        <Card variant="surface" style={{ padding: 48, textAlign: "center" }}>
          <Text color="gray" size="2">
            未检索到符合当前筛选条件的作品，请尝试调整赛道或搜索关键词
          </Text>
        </Card>
      ) : (
        <Flex direction="column" gap="3">
          {filteredBooks.map((book: MarketBook, idx: number) => {
            const rank = idx + 1;
            const rankStyle = getRankBadgeStyle(rank);
            const bookKey = book.book_id || book.id || `book-${idx}`;
            const readCount = book.in_read_count ?? book.read_count;
            const delta7d = book.delta_7d ?? book.gain_7d;
            const bookStatus = book.lifecycle_status ?? book.status;

            return (
              <Card
                key={bookKey}
                variant="surface"
                style={{
                  padding: "16px",
                  borderRadius: 10,
                  border: "1px solid var(--gray-a4)",
                  transition: "box-shadow 0.2s, border-color 0.2s",
                }}
              >
                <Flex justify="between" align="center" wrap="wrap" gap="4">
                  {/* 左侧：排名序号、封面、书名、作者、标签 */}
                  <Flex align="center" gap="3" style={{ flex: 1, minWidth: 320 }}>
                    {/* 排名徽章 */}
                    <Box
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "0.95rem",
                        backgroundColor: rankStyle.bg,
                        color: rankStyle.color,
                        border: `1px solid ${rankStyle.border}`,
                        flexShrink: 0,
                      }}
                    >
                      {rank}
                    </Box>

                    {/* 书籍封面 */}
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        style={{
                          width: 48,
                          height: 64,
                          borderRadius: 4,
                          objectFit: "cover",
                          border: "1px solid var(--gray-a4)",
                          cursor: "pointer",
                        }}
                        onClick={() => openDrawer(book.book_id)}
                      />
                    ) : (
                      <Box
                        style={{
                          width: 48,
                          height: 64,
                          borderRadius: 4,
                          background: "var(--accent-3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                        onClick={() => openDrawer(book.book_id)}
                      >
                        <BookOpen size={20} color="var(--accent-9)" />
                      </Box>
                    )}

                    {/* 详情描述 */}
                    <Box>
                      <Flex align="center" gap="2" wrap="wrap">
                        <Text
                          size="3"
                          weight="bold"
                          style={{ cursor: "pointer", color: "var(--gray-12)" }}
                          onClick={() => openDrawer(book.book_id)}
                        >
                          《{book.title}》
                        </Text>
                        <Badge
                          size="1"
                          color={book.channel === "male" ? "blue" : "pink"}
                          variant="soft"
                        >
                          {book.channel === "male" ? "男频" : "女频"} · {book.category}
                        </Badge>
                        {getLifecycleBadge(bookStatus)}
                        {book.debut_days <= 7 && (
                          <Badge size="1" color="orange" variant="solid">
                            首秀
                          </Badge>
                        )}
                      </Flex>

                      <Text size="2" color="gray" style={{ display: "block", marginTop: 4 }}>
                        作者：{book.author} · {(book.word_count / 10000).toFixed(1)}万字 · {book.platform ?? "番茄小说"}
                      </Text>

                      <Flex gap="1" style={{ marginTop: 6 }} wrap="wrap">
                        {book.tags.slice(0, 4).map((tag: string) => (
                          <Badge key={tag} size="1" variant="surface" color="gray">
                            #{tag}
                          </Badge>
                        ))}
                      </Flex>
                    </Box>
                  </Flex>

                  {/* 中间：真实在读数据与7天趋势 */}
                  <Flex align="center" gap="5" style={{ minWidth: 220 }}>
                    <Box style={{ textAlign: "right" }}>
                      <Text size="1" color="gray" weight="medium">
                        真实在读
                      </Text>
                      <Text size="5" weight="bold" color="red" style={{ display: "block" }}>
                        {(readCount / 10000).toFixed(1)}
                        <Text size="2" weight="regular" color="gray">
                          {" "}万
                        </Text>
                      </Text>
                    </Box>

                    <Box style={{ textAlign: "right" }}>
                      <Text size="1" color="gray" weight="medium">
                        7天涨跌追踪
                      </Text>
                      <Flex align="center" justify="end" gap="1" style={{ marginTop: 2 }}>
                        {delta7d >= 0 ? (
                          <TrendingUp size={15} color="var(--green-9)" />
                        ) : (
                          <TrendingDown size={15} color="var(--red-9)" />
                        )}
                        <Text
                          size="3"
                          weight="bold"
                          color={delta7d >= 0 ? "green" : "red"}
                        >
                          {delta7d >= 0 ? `+${(delta7d / 10000).toFixed(1)}` : `${(delta7d / 10000).toFixed(1)}`}万
                        </Text>
                      </Flex>
                    </Box>
                  </Flex>

                  {/* 右侧：快捷操作入口 */}
                  <Flex align="center" gap="2">
                    <Tooltip content="查看7天/30天留存走势图与开篇前三章正文">
                      <Button
                        variant="surface"
                        size="2"
                        color="gray"
                        onClick={() => openDrawer(book.book_id)}
                      >
                        <BarChart3 size={14} />
                        走势透视
                      </Button>
                    </Tooltip>

                    <Tooltip content="一键分析前三章正文与22维架构拆解">
                      <Button
                        variant="solid"
                        size="2"
                        color="red"
                        onClick={() => openDrawer(book.book_id)}
                      >
                        <Flame size={14} />
                        AI 拆解
                      </Button>
                    </Tooltip>
                  </Flex>
                </Flex>
              </Card>
            );
          })}
        </Flex>
      )}

      {/* 走势与正文抽屉弹窗 */}
      <BookTrendDrawer
        bookId={drawerBookId}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onSelectForTopic={onSelectForTopic}
      />
    </Box>
  );
}
