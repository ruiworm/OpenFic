/**
 * 大盘题材洞察总表与决策指标卡 (Genre Market Overview)
 */

import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Table,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import {
  ArrowDownRight,
  ArrowUpRight,
  Compass,
  Flame,
  Globe2,
  HelpCircle,
  Layers,
  TrendingUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { MarketOverviewResponse } from "../types/market.types";

interface GenreOverviewTableProps {
  overview: MarketOverviewResponse;
  onSelectCategory: (category: string) => void;
}

export function GenreOverviewTable({ overview, onSelectCategory }: GenreOverviewTableProps) {
  const { t } = useTranslation();

  return (
    <Flex direction="column" gap="4">
      {/* 4 大核心 KPI 决策卡片 */}
      <Grid columns={{ initial: "1", sm: "2", md: "4" }} gap="3">
        {/* 全网总盘 */}
        <Card
          style={{
            background: "var(--color-background)",
            border: "1px solid var(--gray-a4)",
            padding: "var(--space-3)",
          }}
        >
          <Flex direction="column" gap="1">
            <Flex justify="between" align="center">
              <Text size="1" color="gray" weight="medium">
                {t("market.kpiTotalRead", "全网在读总盘")}
              </Text>
              <Globe2 size={16} color="var(--accent-9)" />
            </Flex>
            <Heading size="6" weight="bold">
              {overview.total_market_read_formatted}
            </Heading>
            <Text size="1" color="gray">
              {t("market.kpiTotalReadHint", "覆盖主流男女频 18 个核心细分品类")}
            </Text>
          </Flex>
        </Card>

        {/* 7日狂飙题材 */}
        <Card
          style={{
            background: "var(--color-background)",
            border: "1px solid var(--accent-a5)",
            padding: "var(--space-3)",
          }}
        >
          <Flex direction="column" gap="1">
            <Flex justify="between" align="center">
              <Text size="1" color="gray" weight="medium">
                {t("market.kpiSurgingGenre", "7日狂飙新风口")}
              </Text>
              <TrendingUp size={16} color="var(--green-9)" />
            </Flex>
            <Flex align="baseline" gap="2">
              <Heading size="5" weight="bold">
                {overview.top_growing_genre.name}
              </Heading>
              <Badge color="green" variant="surface" size="1">
                +{overview.top_growing_genre.growth_rate_7d}%
              </Badge>
            </Flex>
            <Text size="1" color="gray" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {overview.top_growing_genre.summary}
            </Text>
          </Flex>
        </Card>

        {/* 最卷红海赛道 */}
        <Card
          style={{
            background: "var(--color-background)",
            border: "1px solid var(--red-a4)",
            padding: "var(--space-3)",
          }}
        >
          <Flex direction="column" gap="1">
            <Flex justify="between" align="center">
              <Text size="1" color="gray" weight="medium">
                {t("market.kpiRedOceanGenre", "极度内卷赛道")}
              </Text>
              <Flame size={16} color="var(--red-9)" />
            </Flex>
            <Flex align="baseline" gap="2">
              <Heading size="5" weight="bold">
                {overview.most_competitive_genre.name}
              </Heading>
              <Badge color="red" variant="surface" size="1">
                换手率 {overview.most_competitive_genre.turnover_rate}%
              </Badge>
            </Flex>
            <Text size="1" color="gray">
              日均首秀 {overview.most_competitive_genre.daily_debut_count} 本 · 竞争白热化
            </Text>
          </Flex>
        </Card>

        {/* 蓝海高潜赛道 */}
        <Card
          style={{
            background: "var(--color-background)",
            border: "1px solid var(--blue-a4)",
            padding: "var(--space-3)",
          }}
        >
          <Flex direction="column" gap="1">
            <Flex justify="between" align="center">
              <Text size="1" color="gray" weight="medium">
                {t("market.kpiBlueOceanGenre", "蓝海高潜推荐")}
              </Text>
              <Compass size={16} color="var(--blue-9)" />
            </Flex>
            <Flex align="baseline" gap="2">
              <Heading size="5" weight="bold">
                {overview.blue_ocean_genre.name}
              </Heading>
              <Badge color="blue" variant="surface" size="1">
                高留存首选
              </Badge>
            </Flex>
            <Text size="1" color="gray" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {overview.blue_ocean_genre.summary}
            </Text>
          </Flex>
        </Card>
      </Grid>

      {/* 题材大盘数据表格 */}
      <Card
        style={{
          background: "var(--color-background)",
          border: "1px solid var(--gray-a4)",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <Box p="3" style={{ borderBottom: "1px solid var(--gray-a4)" }}>
          <Flex justify="between" align="center">
            <Flex align="center" gap="2">
              <Layers size={16} color="var(--accent-9)" />
              <Heading size="3" weight="bold">
                {t("market.genreTableTitle", "各赛道热度、涨跌走势与供需换手率大盘")}
              </Heading>
            </Flex>
            <Text size="1" color="gray">
              {t("market.dataUpdated", "更新时间：")}{overview.updated_at}
            </Text>
          </Flex>
        </Box>

        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>{t("market.colGenre", "题材赛道")}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t("market.colChannel", "频道")}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t("market.colTotalRead", "当前在读总盘")}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Flex align="center" gap="1">
                  <span>{t("market.colGrowth7d", "7日涨跌幅")}</span>
                  <Tooltip content={t("market.growth7dTip", "根据7天在读差值计算，>15%为强势上升期")}>
                    <HelpCircle size={12} color="var(--gray-8)" />
                  </Tooltip>
                </Flex>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t("market.colGrowth30d", "30日走势")}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Flex align="center" gap="1">
                  <span>{t("market.colDailyDebut", "日均首秀供给")}</span>
                  <Tooltip content={t("market.dailyDebutTip", "每日通过首秀审核的新书数量，直观反映作者供给拥挤度")}>
                    <HelpCircle size={12} color="var(--gray-8)" />
                  </Tooltip>
                </Flex>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Flex align="center" gap="1">
                  <span>{t("market.colTurnover", "题材换手率")}</span>
                  <Tooltip content={t("market.turnoverTip", "TOP50榜单新书轮换比例。>60%为快餐短命赛道；30%~45%为兼顾破局与长尾的黄金赛道")}>
                    <HelpCircle size={12} color="var(--gray-8)" />
                  </Tooltip>
                </Flex>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t("market.colCompetition", "竞争态势")}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">{t("common.actions", "操作")}</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {overview.genres.map((g) => {
              const isUp = g.growth_rate_7d >= 0;
              return (
                <Table.Row key={g.name} style={{ verticalAlign: "middle" }}>
                  <Table.RowHeaderCell>
                    <Flex align="center" gap="2">
                      <Text weight="bold" size="2">
                        {g.name}
                      </Text>
                      {g.is_blue_ocean && (
                        <Badge color="blue" variant="soft" size="1">
                          蓝海
                        </Badge>
                      )}
                    </Flex>
                  </Table.RowHeaderCell>
                  <Table.Cell>
                    <Badge color={g.channel === "male" ? "blue" : "pink"} variant="surface" size="1">
                      {g.channel === "male" ? "男频" : "女频"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" weight="medium">
                      {g.read_count_formatted}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" gap="1">
                      {isUp ? (
                        <ArrowUpRight size={14} color="var(--green-9)" />
                      ) : (
                        <ArrowDownRight size={14} color="var(--red-9)" />
                      )}
                      <Text size="2" weight="bold" color={isUp ? "green" : "red"}>
                        {isUp ? `+${g.growth_rate_7d}%` : `${g.growth_rate_7d}%`}
                      </Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {g.growth_rate_30d >= 0 ? `+${g.growth_rate_30d}%` : `${g.growth_rate_30d}%`}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{g.daily_debut_count} 本/天</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      size="1"
                      variant="surface"
                      color={g.turnover_rate > 55 ? "red" : g.turnover_rate < 30 ? "gray" : "green"}
                    >
                      {g.turnover_rate}%
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      size="1"
                      variant="soft"
                      color={
                        g.competition_level === "intense"
                          ? "red"
                          : g.competition_level === "high"
                            ? "amber"
                            : g.competition_level === "low"
                              ? "green"
                              : "blue"
                      }
                    >
                      {g.competition_level === "intense"
                        ? "白热化"
                        : g.competition_level === "high"
                          ? "偏卷"
                          : g.competition_level === "low"
                            ? "蓝海低竞争"
                            : "适中"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell align="right">
                    <Button
                      size="1"
                      variant="soft"
                      color="gray"
                      onClick={() => onSelectCategory(g.name)}
                    >
                      {t("market.viewRankings", "查榜")}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </Card>
    </Flex>
  );
}
