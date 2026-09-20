/**
 * ProjectCard Component
 *
 * 3D 精装立体书架卡片组件，支持逼真书脊光影、无封面艺术渐变生成与优雅元数据徽章。
 */

import { Box, Flex, Text, IconButton, Tooltip } from "@radix-ui/themes";
import { Edit2, Trash2, Clock, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import type { Project } from "@/lib/project.types";
import { formatRelativeTime } from "@/lib/time-utils";

import "./project-card.css";

const MotionBox = motion.create(Box);

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

const COVER_PALETTES = [
  { bg: "linear-gradient(145deg, #1e1b4b 0%, #312e81 45%, #4338ca 100%)", crest: "墨" }, // 极光紫墨
  { bg: "linear-gradient(145deg, #064e3b 0%, #065f46 45%, #047857 100%)", crest: "竹" }, // 苍翠竹海
  { bg: "linear-gradient(145deg, #7c2d12 0%, #9a3412 45%, #c2410c 100%)", crest: "炎" }, // 烈阳熔金
  { bg: "linear-gradient(145deg, #0f172a 0%, #1e293b 45%, #334155 100%)", crest: "星" }, // 幽夜繁星
  { bg: "linear-gradient(145deg, #581c87 0%, #6b21a8 45%, #86198f 100%)", crest: "华" }, // 紫曜华章
  { bg: "linear-gradient(145deg, #134e4a 0%, #115e59 45%, #0f766e 100%)", crest: "澜" }, // 沧海青澜
  { bg: "linear-gradient(145deg, #701a75 0%, #831843 45%, #9f1239 100%)", crest: "朱" }, // 胭脂朱砂
  { bg: "linear-gradient(145deg, #1c1917 0%, #292524 45%, #44403c 100%)", crest: "古" }, // 黑曜古卷
];

function getCoverStyle(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  }
  const palette = COVER_PALETTES[hash % COVER_PALETTES.length];
  const firstChar = title.trim().charAt(0) || palette.crest;
  return { bg: palette.bg, char: firstChar };
}

export function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/projects/${project.id}`);
  };

  const coverInfo = getCoverStyle(project.title);

  // 友好字数呈现
  const formattedWordCount =
    project.wordCount >= 10000
      ? `${(project.wordCount / 10000).toFixed(1)} 万`
      : project.wordCount.toLocaleString();

  return (
    <MotionBox
      className="project-card-container"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      onClick={handleClick}
    >
      {/* 3D 立体书封 */}
      <div className="project-card-book">
        {/* 左侧书脊折痕立体反光 */}
        <div className="project-book-spine" />
        {/* 右侧书页微反光 */}
        <div className="project-book-edge" />

        {project.coverUrl ? (
          <img
            src={project.coverUrl}
            alt={project.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          /* 智能艺术渐变封面 */
          <div
            className="project-art-cover"
            style={{ background: coverInfo.bg }}
          >
            <div className="project-art-frame" />
            <div className="project-art-crest">{coverInfo.char}</div>

            <div>
              <div className="project-art-title-text">{project.title}</div>
              <div className="project-art-footer">
                <span>NOVELFORGE</span>
                <Sparkles size={11} style={{ opacity: 0.7 }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 项目标题与元信息 */}
      <Box pt="1">
        <Text
          size="3"
          weight="bold"
          style={{
            display: "block",
            lineHeight: 1.3,
            marginBottom: "8px",
            color: "var(--gray-12)",
          }}
          truncate
        >
          {project.title}
        </Text>

        {/* 徽章胶囊行 */}
        <Flex
          gap="2"
          align="center"
          mb="2"
        >
          <span className="project-meta-pill project-meta-words">
            {formattedWordCount} {t("projects.words")}
          </span>
          <span className="project-meta-pill project-meta-chapters">
            {project.chapterCount} {t("projects.chapters")}
          </span>
        </Flex>

        {/* 底部更新时间与操作 */}
        <Flex
          justify="between"
          align="center"
          pt="1"
        >
          <Flex
            align="center"
            gap="1"
            style={{ color: "var(--gray-10)" }}
          >
            <Clock size={11} />
            <Text size="1">{formatRelativeTime(project.updatedAt)}</Text>
          </Flex>

          <Flex
            gap="1"
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip content={t("common.edit")}>
              <IconButton
                size="1"
                variant="ghost"
                color="gray"
                onClick={() => onEdit(project)}
                style={{ cursor: "pointer", borderRadius: "6px" }}
              >
                <Edit2 size={13} />
              </IconButton>
            </Tooltip>
            <Tooltip content={t("common.delete")}>
              <IconButton
                size="1"
                variant="ghost"
                color="red"
                onClick={() => onDelete(project)}
                style={{ cursor: "pointer", borderRadius: "6px" }}
              >
                <Trash2 size={13} />
              </IconButton>
            </Tooltip>
          </Flex>
        </Flex>
      </Box>
    </MotionBox>
  );
}
