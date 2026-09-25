"""正文排版折叠的回归测试。

背景：模型受训练语料影响常把段落写成 ``\\n\\n``（Markdown 习惯），
而项目规范要求正文相邻段落之间只允许一个 ``\\n``（见 ``app/skills/prose-format.yaml``）。
提示词只能降低概率，``collapse_blank_lines`` 是落库前那道确定性兜底。
"""

from app.core.prose_text import collapse_blank_lines


def test_collapses_single_blank_line_between_paragraphs() -> None:
    assert collapse_blank_lines("第一段\n\n第二段") == "第一段\n第二段"


def test_collapses_multiple_blank_lines_into_one_newline() -> None:
    assert collapse_blank_lines("第一段\n\n\n\n第二段") == "第一段\n第二段"


def test_keeps_single_newline_untouched() -> None:
    """已经是规范排版时结果必须完全不变（幂等的前提）。"""
    text = "第一段\n第二段\n第三段"
    assert collapse_blank_lines(text) == text


def test_only_removes_blank_lines_and_never_merges_paragraphs() -> None:
    """核心回归点：折叠后段落之间仍必须留有换行，不能把两段粘成一段。"""
    result = collapse_blank_lines("甲段\n\n乙段")
    assert "\n" in result
    assert "甲段" in result and "乙段" in result
    assert result != "甲段乙段"


def test_does_not_touch_paragraph_text_or_inline_whitespace() -> None:
    text = "他 说：“ 你 走 吧 ”，然后    转身。\n\n她 没 有 动 。"
    result = collapse_blank_lines(text)
    assert result == "他 说：“ 你 走 吧 ”，然后    转身。\n她 没 有 动 。"


def test_normalizes_crlf_and_lone_cr() -> None:
    assert collapse_blank_lines("甲段\r\n\r\n乙段") == "甲段\n乙段"
    assert collapse_blank_lines("甲段\r\r乙段") == "甲段\n乙段"


def test_strips_leading_and_trailing_newlines_by_default() -> None:
    assert collapse_blank_lines("\n\n甲段\n\n乙段\n\n") == "甲段\n乙段"


def test_keeps_edge_newlines_when_strip_edges_disabled() -> None:
    """作为"替换片段"使用时不能吃掉首尾换行，否则会影响与上下文的拼接。"""
    assert collapse_blank_lines("\n\n甲段\n\n", strip_edges=False) == "\n甲段\n"


def test_returns_empty_input_unchanged() -> None:
    assert collapse_blank_lines("") == ""


def test_is_idempotent() -> None:
    messy = "甲段\n\n\n乙段\n\n丙段\n"
    once = collapse_blank_lines(messy)
    assert collapse_blank_lines(once) == once


def test_handles_realistic_multi_paragraph_chapter() -> None:
    """贴近线上真实数据：9/11 章原本是段间空行，折叠后应变成紧凑排版。"""
    raw = (
        "他把碗放下。\n\n"
        "“以后这种事不用你做。”\n\n"
        "她没有说话。\n\n"
        "窗外开始下雨。"
    )
    assert collapse_blank_lines(raw) == (
        "他把碗放下。\n" "“以后这种事不用你做。”\n" "她没有说话。\n" "窗外开始下雨。"
    )
