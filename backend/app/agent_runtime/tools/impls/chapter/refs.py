from __future__ import annotations

import re
from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, Literal, Protocol, TypeVar

from pydantic import BaseModel, Field, field_validator, model_validator

from app.agent_runtime.tools.errors import ToolExecutionError

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

_REF_ALIASES: tuple[tuple[str, str], ...] = (("order", "order"), ("title", "title"))

# 定位失败时最多列举多少个候选，避免提示过长挤占上下文
_MAX_LISTED_SCOPE_ITEMS = 12

_CN_DIGITS: dict[str, int] = {
    "零": 0,
    "〇": 0,
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
}
_CN_UNITS: dict[str, int] = {"十": 10, "百": 100, "千": 1000}

# 只认行首的「第X章/回/节/篇」，避免把正文里的「第二章」误当编号
_TITLE_NUMBER_RE = re.compile(
    r"^\s*第\s*([0-9]+|[零〇一二两三四五六七八九十百千]+)\s*[章回节篇]"
)


def parse_title_chapter_number(title: str) -> int | None:
    """取出标题前缀「第十二章」里的编号（→ 12）；取不到返回 None。

    章节 order 是**卷内序号**，标题编号是**书名里的序号**，两者可能整体错开
    （跨卷连续编号）或局部错位（删章后未重编号）。判断错位要靠这个函数。
    """
    if not title:
        return None
    match = _TITLE_NUMBER_RE.match(title)
    if match is None:
        return None
    token = match.group(1)
    if token.isdigit():
        return int(token)
    section = 0
    digit = 0
    for char in token:
        if char in _CN_DIGITS:
            digit = _CN_DIGITS[char]
        elif char in _CN_UNITS:
            section += (digit or 1) * _CN_UNITS[char]
            digit = 0
        else:
            return None
    return section + digit


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


async def _similar_volume_hint(
    session: AsyncSession,
    volume_id: str,
    volume_title: str | None,
) -> str | None:
    """目标卷为空时，找同项目里标题相近且**有内容**的卷。

    默认项目会预建若干空卷；用户之后新建的真卷标题往往是它的扩展（「第一卷」vs
    「第一卷 显形」）。模型按 order 命中前者时会拿到「没有任何章节」——
    若不点明还有个同名近似的真卷，模型很容易改去**往占位卷里新建章节**。
    """
    if not volume_title:
        return None
    from app.storage.repos import chapter_repo, volume_repo

    current = await volume_repo.get_by_id(session, volume_id)
    if current is None:
        return None
    normalized = volume_title.replace(" ", "").strip()
    if not normalized:
        return None

    candidates: list[str] = []
    for volume in await volume_repo.list_by_project(session, current.project_id):
        if volume.id == volume_id:
            continue
        other = volume.title.replace(" ", "").strip()
        if not other or not (normalized in other or other in normalized):
            continue
        chapter_count = len(
            await chapter_repo.list_metadata_by_volume(session, volume.id)
        )
        if chapter_count == 0:
            continue
        candidates.append(
            f"「{volume.title}」（order={volume.order}，共 {chapter_count} 章，"
            f"volume_ref={{'type': 'title', 'value': '{volume.title}'}}）"
        )
    if not candidates:
        return None
    return (
        "注意：项目中还有标题相近的卷："
        + "、".join(candidates)
        + "；你可能是定位到了空占位卷，若目标为它请改用上面的 volume_ref"
    )


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
        parts = [f"{scope}下没有任何章节"]
        similar = await _similar_volume_hint(session, volume_id, volume_title)
        parts.append(similar or "可用 list_chapters 确认")
        parts.append("若确认要在这一卷新建章节，再用 write_chapter")
        return "。".join(parts)

    orders = sorted(chapter.order for chapter in metadata)
    return (
        f"{scope}共 {len(metadata)} 章，卷内序号 order 为 {orders[0]}..{orders[-1]}："
        f"{_format_scope_items(metadata, '章')}；"
        "order 按卷内从 1 重新计数，可能与章节标题里的编号不一致，请以 list_chapters 返回的 order 为准"
    )


async def order_title_mismatch_notice(
    session: AsyncSession,
    *,
    volume_id: str,
    chapter: _OrderedTitled | None,
) -> str | None:
    """按 order 命中章节后，若本卷 order 与标题编号错位，给出可自纠的提示。

    只在**本卷内部确实错位**时才提示：若全卷「order - 标题编号」的差值一致
    （第二卷标题从第十三章起连续编号属正常），就静默，不打扰模型。

    存在的理由：「未找到章节」已经会报错，但**定位成功却命中错的章**是静默的——
    例如 order=12 合法地返回了「第六章」，模型会当成第十二章直接总结。
    """
    if chapter is None:
        return None
    number = parse_title_chapter_number(chapter.title)
    if number is None or number == chapter.order:
        return None

    from app.storage.repos import chapter_repo

    metadata = await chapter_repo.list_metadata_by_volume(session, volume_id)
    offsets = {
        item.order - parsed
        for item in metadata
        if (parsed := parse_title_chapter_number(item.title)) is not None
    }
    if len(offsets) <= 1:
        return None

    claimed = sorted(
        item.order
        for item in metadata
        if parse_title_chapter_number(item.title) == chapter.order
    )
    where = (
        f"本卷里标题编号为 {chapter.order} 的章节在 order={claimed[0]}"
        if claimed
        else f"本卷里没有标题编号为 {chapter.order} 的章节"
    )
    return (
        f"注意：order={chapter.order} 命中「{chapter.title}」，"
        f"标题里的编号（{number}）与 order 不一致——{where}。"
        "本卷 order 与标题编号已错开，请以 list_chapters 的 order 为准；"
        f"按标题读请传 chapter_ref={{'type': 'title', 'value': '{chapter.title}'}}"
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
