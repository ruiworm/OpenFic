/**
 * ProjectListItem Component
 *
 * List 视图下的项目列表项组件，呈现精简立体书封与规整元数据。
 */

import { Box, Card, Flex, Text, IconButton, Tooltip } from "@radix-ui/themes";
import { Edit2, Trash2, Clock } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import type { Project } from "@/lib/project.types";
import { formatRelativeTime } from "@/lib/time-utils";

import "./project-card.css";

const MotionCard = motion.create(Card);

interface ProjectListItemProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

const COVER_PALETTES = [
  { bg: "linear-gradient(145deg, #1e1b4b 0%, #312e81 45%, #4338ca 100%)", crest: "墨" },
  { bg: "linear-gradient(145deg, #064e3b 0%, #065f46 45%, #047857 100%)", crest: "竹" },
  { bg: "linear-gradient(145deg, #7c2d12 0%, #9a3412 45%, #c2410c 100%)", crest: "炎" },
  { bg: "linear-gradient(145deg, #0f172a 0%, #1e293b 45%, #334155 100%)", crest: "星" },
  { bg: "linear-gradient(145deg, #581c87 0%, #6b21a8 45%, #86198f 100%)", crest: "华" },
  { bg: "linear-gradient(145deg, #134e4a 0%, #115e59 45%, #0f766e 100%)", crest: "澜" },
  { bg: "linear-gradient(145deg, #701a75 0%, #831843 45%, #9f1239 100%)", crest: "朱" },
  { bg: "linear-gradient(145deg, #1c1917 0%, #292524 45%, #44403c 100%)", crest: "古" },
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

export function ProjectListItem({ project, onEdit, onDelete }: ProjectListItemProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/projects/${project.id}`);
  };

  const coverInfo = getCoverStyle(project.title);
  const formattedWordCount =
    project.wordCount >= 10000
      ? `${(project.wordCount / 10000).toFixed(1)} 万`
      : project.wordCount.toLocaleString();

  return (
    <MotionCard
      size="2"
      style={{
        cursor: "pointer",
        borderRadius: "10px",
        border: "1px solid var(--gray-a4)",
        background: "color-mix(in srgb, var(--theme-panel-background) 92%, transparent)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{
        x: 4,
        borderColor: "color-mix(in srgb, var(--accent-9) 35%, var(--gray-a4))",
        boxShadow: "var(--book-card-shadow)",
      }}
      transition={{ duration: 0.18 }}
      onClick={handleClick}
    >
      <Flex
        align="center"
        gap="3"
      >
        {/* 左侧小封套 */}
        <Box
          style={{
            width: "52px",
            height: "72px",
            position: "relative",
            overflow: "hidden",
            borderRadius: "6px",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
            flexShrink: 0,
          }}
        >
          <div className="project-book-spine" style={{ width: "8px" }} />
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
            <Flex
              align="center"
              justify="center"
              style={{
                width: "100%",
                height: "100%",
                background: coverInfo.bg,
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "20px",
                fontFamily: "var(--app-font-family)",
                textShadow: "0 1px 2px rgba(0,0,0,0.4)",
              }}
            >
              {coverInfo.char}
            </Flex>
          )}
        </Box>

        {/* 中间项目信息 */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text
            size="3"
            weight="bold"
            truncate
            style={{ color: "var(--gray-12)" }}
          >
            {project.title}
          </Text>
          {project.description && (
            <Text
              size="2"
              color="gray"
              truncate
              style={{ display: "block", marginTop: "2px", opacity: 0.85 }}
            >
              {project.description}
            </Text>
          )}
          <Flex
            gap="2"
            mt="2"
            align="center"
          >
            <span className="project-meta-pill project-meta-words">
              {formattedWordCount} {t("projects.words")}
            </span>
            <span className="project-meta-pill project-meta-chapters">
              {project.chapterCount} {t("projects.chapters")}
            </span>
            <Flex
              align="center"
              gap="1"
              ml="1"
              style={{ color: "var(--gray-10)", fontSize: "11px" }}
            >
              <Clock size={11} />
              <span>{formatRelativeTime(project.updatedAt)}</span>
            </Flex>
          </Flex>
        </Box>

        {/* 右侧操作按钮 */}
        <Flex
          gap="2"
          align="center"
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip content={t("common.edit")}>
            <IconButton
              size="2"
              variant="ghost"
              color="gray"
              onClick={() => onEdit(project)}
              style={{ cursor: "pointer", borderRadius: "6px" }}
            >
              <Edit2 size={15} />
            </IconButton>
          </Tooltip>
          <Tooltip content={t("common.delete")}>
            <IconButton
              size="2"
              variant="ghost"
              color="red"
              onClick={() => onDelete(project)}
              style={{ cursor: "pointer", borderRadius: "6px" }}
            >
              <Trash2 size={15} />
            </IconButton>
          </Tooltip>
        </Flex>
      </Flex>
    </MotionCard>
  );
}
