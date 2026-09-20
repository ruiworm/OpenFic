# -*- coding: utf-8 -*-
"""Foreshadowing Repository - 伏笔与线索数据访问层。"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete as sql_delete
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col

from app.storage.models.foreshadowing import Foreshadowing


async def create(session: AsyncSession, foreshadowing: Foreshadowing) -> Foreshadowing:
    """创建伏笔。"""
    session.add(foreshadowing)
    await session.flush()
    await session.refresh(foreshadowing)
    return foreshadowing


async def get_by_id(session: AsyncSession, foreshadowing_id: str) -> Foreshadowing | None:
    """按 ID 获取伏笔。"""
    result = await session.execute(
        select(Foreshadowing).where(col(Foreshadowing.id) == foreshadowing_id)
    )
    return result.scalar_one_or_none()


async def list_by_project(
    session: AsyncSession,
    project_id: str,
    status: str | None = None,
    importance: str | None = None,
    chapter_id: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[Foreshadowing], int]:
    """按项目分页获取伏笔列表。"""
    conditions = [col(Foreshadowing.project_id) == project_id]
    if status:
        conditions.append(col(Foreshadowing.status) == status)
    if importance:
        conditions.append(col(Foreshadowing.importance) == importance)
    if chapter_id:
        conditions.append(
            (col(Foreshadowing.planted_chapter_id) == chapter_id)
            | (col(Foreshadowing.resolved_chapter_id) == chapter_id)
        )

    count_result = await session.execute(
        select(func.count(col(Foreshadowing.id))).where(*conditions)
    )
    total = count_result.scalar_one()

    offset = (page - 1) * page_size
    query = (
        select(Foreshadowing)
        .where(*conditions)
        .order_by(col(Foreshadowing.updated_at).desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await session.execute(query)
    return list(result.scalars().all()), total


async def list_all_active_by_project(
    session: AsyncSession,
    project_id: str,
) -> list[Foreshadowing]:
    """获取项目下所有未收束/活跃的伏笔（planted, developing）。"""
    query = (
        select(Foreshadowing)
        .where(
            col(Foreshadowing.project_id) == project_id,
            col(Foreshadowing.status).in_(["planted", "developing"]),
        )
        .order_by(col(Foreshadowing.created_at).asc())
    )
    result = await session.execute(query)
    return list(result.scalars().all())


async def update(
    session: AsyncSession,
    foreshadowing_id: str,
    **kwargs: Any,
) -> Foreshadowing | None:
    """更新伏笔。"""
    foreshadowing = await get_by_id(session, foreshadowing_id)
    if not foreshadowing:
        return None

    for key, value in kwargs.items():
        if hasattr(foreshadowing, key):
            setattr(foreshadowing, key, value)

    foreshadowing.updated_at = datetime.now(UTC)
    session.add(foreshadowing)
    await session.flush()
    await session.refresh(foreshadowing)
    return foreshadowing


async def delete(session: AsyncSession, foreshadowing_id: str) -> bool:
    """删除伏笔。"""
    result = await session.execute(
        sql_delete(Foreshadowing).where(col(Foreshadowing.id) == foreshadowing_id)
    )
    await session.flush()
    return (result.rowcount or 0) > 0
