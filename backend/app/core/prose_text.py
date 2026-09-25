# -*- coding: utf-8 -*-
"""正文排版规范化。

项目规范要求正文相邻段落之间只允许一个换行符 ``\\n``，不得出现空行或连续换行
（见 ``app/skills/prose-format.yaml`` 与内置 agent 提示词的"段落"一节），
但模型受训练语料影响，常按 Markdown 习惯把段落写成 ``\\n\\n``。

这里在落库前做一次确定性折叠，使写入结果符合规范，避免空行进入界面、统计与导出文件。
提示词层面的约束只能降低发生概率，本模块是概率之外的那道兜底。
"""

from __future__ import annotations

import re

# 两个及以上连续换行 = 段落之间出现了空行（``\r\n`` 已先行规整为 ``\n``）
_BLANK_LINE_RUN = re.compile(r"\n{2,}")


def collapse_blank_lines(text: str, *, strip_edges: bool = True) -> str:
    """把连续换行折叠成单个 ``\\n``，即移除段落之间的空行。

    Args:
        text: 原始正文。
        strip_edges: 是否同时去掉首尾多余的换行。整章写入时使用默认值；
            作为"替换片段"使用时传 ``False``，避免影响片段与上下文的拼接。

    Returns:
        折叠后的正文；输入为空时原样返回。

    Note:
        只改动换行结构，不改动任何正文字符，也不触碰行内空白；
        ``\\r\\n`` 与孤立 ``\\r`` 一并规整为 ``\\n``。
    """
    if not text:
        return text
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    collapsed = _BLANK_LINE_RUN.sub("\n", normalized)
    return collapsed.strip("\n") if strip_edges else collapsed
