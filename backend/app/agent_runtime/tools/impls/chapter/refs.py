from collections.abc import Sequence
from typing import Any, Literal, Protocol, TypeVar

from pydantic import BaseModel, Field, field_validator, model_validator

from app.agent_runtime.tools.errors import ToolExecutionError

_REF_ALIASES: tuple[tuple[str, str], ...] = (("order", "order"), ("title", "title"))


def _normalize_ref_payload(data: Any) -> Any:
    """把模型常见的几种简写规约成 {type, value}。

    工具返回结果里的字段名是 ``order`` / ``title``（见 list_volumes、list_chapters
    的 ``ListVolumesItem`` / ``ListChaptersItem``），而定位参数要求的键名是 ``value``。
    模型沿用上下文里的键名、写成 ``{"type":"order","order":2}`` 是高频且可预期的
    错法；这里做一次宽容规约，避免整批工具调用被参数校验直接拒掉。

    无法识别的输入原样返回，交由 pydantic 抛出原本的校验错误，保证错误可见。
    """
    if isinstance(data, dict):
        if "value" in data:
            return data
        for alias, ref_type in _REF_ALIASES:
            if alias in data:
                normalized = dict(data)
                normalized["value"] = normalized[alias]
                normalized.setdefault("type", ref_type)
                return normalized
        return data

    if isinstance(data, bool):
        return data
    if isinstance(data, int):
        return {"type": "order", "value": data}
    if isinstance(data, str):
        text = data.strip()
        if text.isdigit():
            return {"type": "order", "value": int(text)}
        return {"type": "title", "value": text}
    return data


class ChapterRef(BaseModel):
    type: Literal["order", "title"] = Field(
        description="章节定位方式：order 表示卷内章节序号，title 表示章节标题",
    )
    value: int | str = Field(
        description="与 type 对应的章节定位值；type 为 order 时传入整数序号，type 为 title 时传入精确的章节标题",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, data: Any) -> Any:
        return _normalize_ref_payload(data)

    @field_validator("value", mode="before")
    @classmethod
    def coerce_value(cls, v: Any, info: Any) -> int | str:
        if info.data.get("type") == "order":
            return int(v)
        return str(v)


class VolumeRef(BaseModel):
    type: Literal["order", "title"] = Field(
        description="卷定位方式：order 表示卷序号，title 表示卷标题",
    )
    value: int | str = Field(
        description="与 type 对应的卷定位值；type 为 order 时传入整数序号，type 为 title 时传入精确的卷标题",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, data: Any) -> Any:
        return _normalize_ref_payload(data)

    @field_validator("value", mode="before")
    @classmethod
    def coerce_value(cls, v: Any, info: Any) -> int | str:
        if info.data.get("type") == "order":
            return int(v)
        return str(v)


class _OrderedTitled(Protocol):
    order: int
    title: str


_TOrderedTitled = TypeVar("_TOrderedTitled", bound=_OrderedTitled)


def resolve_volume_from_list(
    volumes: Sequence[_TOrderedTitled],
    ref: VolumeRef,
) -> _TOrderedTitled:
    if ref.type == "order":
        match = next((volume for volume in volumes if volume.order == ref.value), None)
    else:
        match = next((volume for volume in volumes if volume.title == ref.value), None)
    if match is None:
        raise ToolExecutionError(f"未找到卷: {ref.type}={ref.value}")
    return match


def resolve_chapter_from_list(
    chapters: Sequence[_TOrderedTitled],
    ref: ChapterRef,
) -> _TOrderedTitled:
    if ref.type == "order":
        match = next((chapter for chapter in chapters if chapter.order == ref.value), None)
    else:
        match = next((chapter for chapter in chapters if chapter.title == ref.value), None)
    if match is None:
        raise ToolExecutionError(f"未找到章节: {ref.type}={ref.value}")
    return match
