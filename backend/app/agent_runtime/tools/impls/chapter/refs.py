from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, Literal, Protocol, TypeVar

from pydantic import BaseModel, Field, field_validator, model_validator

from app.agent_runtime.tools.errors import ToolExecutionError

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

_REF_ALIASES: tuple[tuple[str, str], ...] = (("order", "order"), ("title", "title"))

# 定位失败时最多列举多少个候选，避免提示过长挤占上下文
_MAX_LISTED_SCOPE_ITEMS = 12


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


def _format_scope_items(items: Sequence[_OrderedTitled], unit: str) -> str:
    """把可选项压成 ``1=第一章, 2=第二章`` 形式，过长时截断。"""
    ordered = sorted(items, key=lambda item: item.order)
    listed = ", ".join(
        f"{item.order}={item.title}" for item in ordered[:_MAX_LISTED_SCOPE_ITEMS]
    )
    if len(ordered) > _MAX_LISTED_SCOPE_ITEMS:
        return f"{listed} …（共 {len(ordered)} {unit}）"
    return listed


def _chapter_not_found_message(ref: ChapterRef, scope_hint: str | None) -> str:
    message = f"未找到章节: {ref.type}={ref.value}"
    return f"{message}（{scope_hint}）" if scope_hint else message


def resolve_volume_from_list(
    volumes: Sequence[_TOrderedTitled],
    ref: VolumeRef,
) -> _TOrderedTitled:
    if ref.type == "order":
        match = next((volume for volume in volumes if volume.order == ref.value), None)
    else:
        match = next((volume for volume in volumes if volume.title == ref.value), None)
    if match is None:
        # 带上项目里实际存在的卷，模型据此可直接改用正确的定位值，无需额外试错
        detail = f"未找到卷: {ref.type}={ref.value}"
        if volumes:
            detail += (
                f"（当前项目共 {len(volumes)} 卷："
                f"{_format_scope_items(volumes, '卷')}；可用 list_volumes 查看）"
            )
        raise ToolExecutionError(detail)
    return match


async def chapter_scope_hint(
    session: AsyncSession,
    volume_id: str,
    volume_title: str | None,
) -> str:
    """描述目标卷的真实章节构成，供模型自行纠正定位参数。"""
    from app.storage.repos import chapter_repo

    scope = f"卷「{volume_title}」" if volume_title else "目标卷"
    metadata = await chapter_repo.list_metadata_by_volume(session, volume_id)
    if not metadata:
        return f"{scope}下没有任何章节，可用 list_chapters 确认，或改用 write_chapter 新建"

    orders = sorted(chapter.order for chapter in metadata)
    return (
        f"{scope}共 {len(metadata)} 章，卷内序号 order 为 {orders[0]}..{orders[-1]}："
        f"{_format_scope_items(metadata, '章')}；"
        "order 按卷内从 1 重新计数，可能与章节标题里的编号不一致，请以 list_chapters 返回的 order 为准"
    )


async def chapter_not_found_error(
    session: AsyncSession,
    *,
    volume_id: str,
    ref: ChapterRef,
    volume_title: str | None = None,
) -> ToolExecutionError:
    """构造带卷内真实范围的"未找到章节"错误，用法：``raise await chapter_not_found_error(...)``。"""
    return ToolExecutionError(
        _chapter_not_found_message(
            ref, await chapter_scope_hint(session, volume_id, volume_title)
        )
    )
