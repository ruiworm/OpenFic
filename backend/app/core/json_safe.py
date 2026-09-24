"""JSON 文本解析的容错封装。

用于「解析失败不应中断主流程」的场景：持久化数据反序列化、历史消息加载、
修订流程等。解析失败时记录 warning（含出错原因与原始文本片段，便于定位）
并返回默认值，避免一条损坏记录让整个会话瘫痪。

注意：本模块只做「降级不抛异常」，不做内容修复。需要尽量把损坏 JSON
还原成结构化数据时使用 ``json_repair``（见 agent_runtime.tool_call_recovery）。
"""

import json
from typing import Any, TypeVar

from loguru import logger

T = TypeVar("T")

# 日志里保留的原始文本片段长度，避免超长 tool_calls 刷爆日志
_SAMPLE_LIMIT = 200


def safe_json_loads(
    raw: Any,
    default: T,
    *,
    context: str,
    expected: type | tuple[type, ...] | None = None,
) -> Any:
    """容错解析 JSON 文本。

    Args:
        raw: 待解析的文本。``None`` / 空串时直接返回 ``default``。
        default: 解析失败或类型不符时返回的兜底值。
        context: 出错的业务上下文（含关键 id），用于日志定位。
        expected: 期望的顶层类型，如 ``list`` / ``dict``；为 ``None`` 时不校验。

    Returns:
        解析结果；失败时为 ``default``。任何情况下都不抛异常。
    """
    if raw is None or raw == "":
        return default

    if not isinstance(raw, (str, bytes, bytearray)):
        # 调用方直接传了结构化对象
        if expected is None or isinstance(raw, expected):
            return raw
        logger.warning(
            "JSON 字段类型不符合预期，已降级为默认值 | context={} expected={} actual={}",
            context,
            _type_name(expected),
            type(raw).__name__,
        )
        return default

    try:
        value = json.loads(raw)
    except (TypeError, ValueError) as exc:
        logger.warning(
            "JSON 解析失败，已降级为默认值 | context={} error={} raw={}",
            context,
            exc,
            _preview(raw),
        )
        return default

    if expected is not None and not isinstance(value, expected):
        logger.warning(
            "JSON 解析结果类型不符合预期，已降级为默认值 | context={} expected={} actual={} raw={}",
            context,
            _type_name(expected),
            type(value).__name__,
            _preview(raw),
        )
        return default

    return value


def _preview(raw: Any) -> str:
    text = raw if isinstance(raw, str) else repr(raw)
    if len(text) > _SAMPLE_LIMIT:
        return f"{text[:_SAMPLE_LIMIT]}... (total {len(text)} chars)"
    return text


def _type_name(expected: type | tuple[type, ...]) -> str:
    if isinstance(expected, tuple):
        return "/".join(item.__name__ for item in expected)
    return expected.__name__
