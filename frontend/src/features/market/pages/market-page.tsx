import { useState } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  Tabs,
  Badge,
  Spinner,
} from "@radix-ui/themes";
import {
  TrendingUp,
  BarChart3,
  Flame,
  Sparkles,
} from "lucide-react";
import { MobileAppSidebarTrigger } from "@/features/app-shell/components/mobile-app-sidebar-trigger";
import { useMarketOverview } from "../hooks/use-market";
import { GenreOverviewTable } from "../components/genre-overview-table";
import { NovelRankingsList } from "../components/novel-rankings-list";
import { TopicIncubator } from "../components/topic-incubator";
import type { MarketBookDetail } from "../types/market.types";
import "./market-page.css";

export function MarketPage() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBookForTopic, setSelectedBookForTopic] = useState<MarketBookDetail | null>(null);

  const { data: overview, isLoading: isOverviewLoading } = useMarketOverview();

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setActiveTab("rankings");
  };

  const handleSelectForTopic = (book: MarketBookDetail) => {
    setSelectedBookForTopic(book);
    setActiveTab("incubator");
  };

  return (
    <Box className="market-page">
      {/* 移动端顶部标题栏 */}
      <Flex className="market-page-mobile-topbar">
        <MobileAppSidebarTrigger />
        <Flex align="center" gap="2">
          <TrendingUp size={16} color="var(--accent-9)" />
          <Text size="2" weight="bold">
            网文扫榜洞察
          </Text>
        </Flex>
        <Box style={{ width: 32 }} />
      </Flex>

      {/* 桌面/通用顶部导航与标题 */}
      <Box className="market-page-header">
        <Flex justify="between" align="center" wrap="wrap" gap="3">
          <Box>
            <Flex align="center" gap="2">
              <TrendingUp size={22} color="var(--accent-9)" />
              <Heading size="5" weight="bold">
                网文大盘扫榜与市场洞察
              </Heading>
              <Badge color="orange" variant="surface" size="1">
                番茄/起点双轨核验
              </Badge>
            </Flex>
            <Text size="2" color="gray" style={{ marginTop: 4, display: "block" }}>
              拒绝盲目跟风与虚火假榜：真实在读数据核验 · 7天/30天留存走势追踪 · 题材换手率大盘 · AI 黄金三章拆解选题闭环
            </Text>
          </Box>

          {/* 标签切换 Tabs */}
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List size="2">
              <Tabs.Trigger value="overview">
                <BarChart3 size={15} style={{ marginRight: 6 }} />
                大盘题材洞察
              </Tabs.Trigger>
              <Tabs.Trigger value="rankings">
                <Flame size={15} style={{ marginRight: 6 }} />
                爆款榜单透视
              </Tabs.Trigger>
              <Tabs.Trigger value="incubator">
                <Sparkles size={15} style={{ marginRight: 6 }} />
                AI 选题孵化
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </Flex>
      </Box>

      {/* 页面主视图容器 */}
      <Box className="market-page-content">
        {activeTab === "overview" && (
          isOverviewLoading || !overview ? (
            <Flex align="center" justify="center" style={{ height: 320 }}>
              <Spinner size="3" />
              <Text size="2" color="gray" ml="2">
                正在加载题材大盘与留存数据...
              </Text>
            </Flex>
          ) : (
            <GenreOverviewTable
              overview={overview}
              onSelectCategory={handleSelectCategory}
            />
          )
        )}

        {activeTab === "rankings" && (
          <NovelRankingsList
            initialCategory={selectedCategory}
            onSelectForTopic={handleSelectForTopic}
          />
        )}

        {activeTab === "incubator" && (
          <TopicIncubator initialBook={selectedBookForTopic} />
        )}
      </Box>
    </Box>
  );
}
