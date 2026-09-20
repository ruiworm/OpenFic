# -*- coding: utf-8 -*-
"""Foreshadowing Router - 伏笔与线索 CRUD API。"""

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.foreshadowing import (
    ForeshadowingCreateRequest,
    ForeshadowingListResponse,
    ForeshadowingResponse,
    ForeshadowingUpdateRequest,
)
from app.storage.database import get_session
from app.storage.models.foreshadowing import Foreshadowing
from app.storage.repos import foreshadowing_repo, project_repo

router = APIRouter(tags=["foreshadowings"])


@router.get(
    "/projects/{project_id}/foreshadowings",
    response_model=ForeshadowingListResponse,
    summary="获取项目伏笔列表",
)
async def list_foreshadowings(
    project_id: str,
    status: Annotated[str | None, Query(description="按状态过滤")] = None,
    importance: Annotated[str | None, Query(description="按重要程度过滤")] = None,
    chapter_id: Annotated[str | None, Query(description="按关联章节过滤")] = None,
    page: Annotated[int, Query(ge=1, description="页码")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="每页数量")] = 50,
    session: AsyncSession = Depends(get_session),
) -> ForeshadowingListResponse:
    """分页获取指定项目的伏笔与线索列表。"""
    project = await project_repo.get_by_id(session, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    items, total = await foreshadowing_repo.list_by_project(
        session=session,
        project_id=project_id,
        status=status,
        importance=importance,
        chapter_id=chapter_id,
        page=page,
        page_size=page_size,
    )
    return ForeshadowingListResponse(
        items=[ForeshadowingResponse.from_orm_model(item) for item in items],
        total=total,
    )


@router.post(
    "/projects/{project_id}/foreshadowings",
    response_model=ForeshadowingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建伏笔",
)
async def create_foreshadowing(
    project_id: str,
    request: ForeshadowingCreateRequest,
    session: AsyncSession = Depends(get_session),
) -> ForeshadowingResponse:
    """创建新的伏笔或线索条目。"""
    project = await project_repo.get_by_id(session, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    char_ids_str = json.dumps(request.character_ids, ensure_ascii=False)
    foreshadowing = Foreshadowing(
        project_id=project_id,
        title=request.title,
        description=request.description,
        status=request.status,
        importance=request.importance,
        planted_chapter_id=request.planted_chapter_id,
        target_chapter_id=request.target_chapter_id,
        resolved_chapter_id=request.resolved_chapter_id,
        character_ids=char_ids_str,
        notes=request.notes,
    )
    created = await foreshadowing_repo.create(session, foreshadowing)
    await session.commit()
    logger.info(f"Created foreshadowing {created.id} in project {project_id}")
    return ForeshadowingResponse.from_orm_model(created)


@router.get(
    "/projects/{project_id}/foreshadowings/{id}",
    response_model=ForeshadowingResponse,
    summary="获取伏笔详情",
)
async def get_foreshadowing(
    project_id: str,
    id: str,
    session: AsyncSession = Depends(get_session),
) -> ForeshadowingResponse:
    """按 ID 获取伏笔详情。"""
    foreshadowing = await foreshadowing_repo.get_by_id(session, id)
    if not foreshadowing or foreshadowing.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Foreshadowing {id} not found",
        )
    return ForeshadowingResponse.from_orm_model(foreshadowing)


@router.patch(
    "/projects/{project_id}/foreshadowings/{id}",
    response_model=ForeshadowingResponse,
    summary="更新伏笔",
)
async def update_foreshadowing(
    project_id: str,
    id: str,
    request: ForeshadowingUpdateRequest,
    session: AsyncSession = Depends(get_session),
) -> ForeshadowingResponse:
    """更新伏笔信息与状态。"""
    foreshadowing = await foreshadowing_repo.get_by_id(session, id)
    if not foreshadowing or foreshadowing.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Foreshadowing {id} not found",
        )

    update_dict = request.model_dump(exclude_unset=True)
    if "character_ids" in update_dict and update_dict["character_ids"] is not None:
        update_dict["character_ids"] = json.dumps(update_dict["character_ids"], ensure_ascii=False)

    updated = await foreshadowing_repo.update(session, id, **update_dict)
    await session.commit()
    return ForeshadowingResponse.from_orm_model(updated)


@router.delete(
    "/projects/{project_id}/foreshadowings/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除伏笔",
)
async def delete_foreshadowing(
    project_id: str,
    id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """删除指定的伏笔条目。"""
    foreshadowing = await foreshadowing_repo.get_by_id(session, id)
    if not foreshadowing or foreshadowing.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Foreshadowing {id} not found",
        )

    await foreshadowing_repo.delete(session, id)
    await session.commit()
    logger.info(f"Deleted foreshadowing {id} from project {project_id}")
