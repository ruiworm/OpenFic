# -*- coding: utf-8 -*-
"""
Markdown 结构化导出生成器 - 将小说章节与卷结构打包为分卷分章的 Markdown ZIP 归档。
零外部第三方依赖，使用标准库 zipfile。兼容 Obsidian、Logseq 及本地笔记管理。
"""

from __future__ import annotations

from pathlib import Path
import re
import time
import zipfile


def _sanitize_filename(name: str, fallback: str = "未命名") -> str:
    cleaned = re.sub(r'[\\/:*?"<>|\x00-\x1f]', " ", name).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:100] or fallback


def build_markdown_zip(
    output_path: Path,
    *,
    book_title: str,
    author: str = "佚名",
    description: str = "",
    volumes: list[dict[str, object]],
    chapters: list[dict[str, object]],
) -> None:
    """
    构建分卷分章 Markdown ZIP 压缩包。

    :param output_path: 输出 .zip 文件路径
    :param book_title: 书名
    :param author: 作者名
    :param description: 作品简介
    :param volumes: 卷列表 [{"id": ..., "title": ..., "order": ...}]
    :param chapters: 章节列表 [{"id": ..., "volume_id": ..., "title": ..., "content": ...}]
    """
    safe_book_title = _sanitize_filename(book_title, "小说归档")
    now_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

    volume_by_id = {str(v.get("id")): v for v in volumes}
    has_volumes = bool(volumes)

    total_words = 0
    for ch in chapters:
        content = str(ch.get("content") or "")
        total_words += len(content)

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # 1. 写入书籍信息 README.md
        meta_md = f"""# {book_title}

- **作者**：{author}
- **导出时间**：{now_str}
- **总字数**：约 {total_words:,} 字
- **总章节数**：{len(chapters)} 章
- **总卷数**：{len(volumes)} 卷

## 作品简介

{description if description.strip() else "暂无简介"}
"""
        zf.writestr(f"{safe_book_title}/README.md", meta_md.encode("utf-8"))

        # 2. 按卷/章节写入 .md 文件
        vol_order_counter = 0
        chap_order_counter = 0

        for ch in chapters:
            chap_order_counter += 1
            vol_id = str(ch.get("volume_id")) if ch.get("volume_id") else None
            chap_title = str(ch.get("title") or f"第{chap_order_counter}章")
            chap_content = str(ch.get("content") or "")

            clean_chap_title = _sanitize_filename(chap_title, f"第{chap_order_counter}章")
            padded_chap_index = f"{chap_order_counter:03d}"
            chap_file_name = f"{padded_chap_index}_{clean_chap_title}.md"

            if has_volumes and vol_id and vol_id in volume_by_id:
                vol = volume_by_id[vol_id]
                vol_order = vol.get("order")
                vol_title = str(vol.get("title") or "分卷")
                clean_vol_title = _sanitize_filename(vol_title, "分卷")
                vol_prefix = f"卷{vol_order}_{clean_vol_title}" if vol_order is not None else clean_vol_title
                entry_path = f"{safe_book_title}/{vol_prefix}/{chap_file_name}"
            else:
                entry_path = f"{safe_book_title}/{chap_file_name}"

            # 格式化章节 Markdown 内容
            content_clean = chap_content.replace("\r\n", "\n").replace("\r", "\n")
            # 保证段落之间有空行（标准 Markdown 格式）
            paragraphs = [p.strip() for p in content_clean.split("\n") if p.strip()]
            formatted_body = "\n\n".join(paragraphs)

            file_content = f"# {chap_title}\n\n{formatted_body}\n"
            zf.writestr(entry_path, file_content.encode("utf-8"))
