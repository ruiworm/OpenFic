# -*- coding: utf-8 -*-
"""Deconstruction Repository - 小说拆解分析报告数据访问层。"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete as sql_delete
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col

from app.storage.models.deconstruction import Deconstruction


async def create(session: AsyncSession, deconstruction: Deconstruction) -> Deconstruction:
    """创建拆解报告。"""
    session.add(deconstruction)
    await session.flush()
    await session.refresh(deconstruction)
    return deconstruction


async def get_by_id(session: AsyncSession, deconstruction_id: str) -> Deconstruction | None:
    """按 ID 获取拆解报告。"""
    result = await session.execute(
        select(Deconstruction).where(col(Deconstruction.id) == deconstruction_id)
    )
    return result.scalar_one_or_none()


async def list_deconstructions(
    session: AsyncSession,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Deconstruction], int]:
    """分页获取拆解报告列表。"""
    conditions = []
    if search:
        search_pattern = f"%{search.strip()}%"
        conditions.append(
            col(Deconstruction.title).ilike(search_pattern)
            | col(Deconstruction.source_title).ilike(search_pattern)
        )

    count_result = await session.execute(
        select(func.count(col(Deconstruction.id))).where(*conditions)
    )
    total = count_result.scalar_one()

    offset = (page - 1) * page_size
    query = (
        select(Deconstruction)
        .where(*conditions)
        .order_by(col(Deconstruction.created_at).desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await session.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update(
    session: AsyncSession,
    deconstruction: Deconstruction,
    **kwargs: Any,
) -> Deconstruction:
    """更新拆解报告。"""
    for key, value in kwargs.items():
        if hasattr(deconstruction, key) and value is not None:
            setattr(deconstruction, key, value)
    deconstruction.updated_at = datetime.now(UTC)
    session.add(deconstruction)
    await session.flush()
    await session.refresh(deconstruction)
    return deconstruction


async def delete(session: AsyncSession, deconstruction_id: str) -> bool:
    """删除拆解报告。"""
    result = await session.execute(
        sql_delete(Deconstruction).where(col(Deconstruction.id) == deconstruction_id)
    )
    await session.flush()
    return result.rowcount > 0
