# -*- coding: utf-8 -*-
"""Deconstructions Router - 小说拆书与仿写 API。"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.deconstruction import (
    CreateProjectFromDeconstructionRequest,
    CreateProjectFromDeconstructionResponse,
    DeconstructionCreateRequest,
    DeconstructionListResponse,
    DeconstructionResponse,
    DeconstructionStreamRequest,
    ExportToNoteRequest,
    ExportToNoteResponse,
)
from app.core.errors import NotFoundError
from app.deconstruction.prompt import DEFAULT_DECONSTRUCTION_PROMPT
from app.deconstruction.service import (
    create_project_from_deconstruction,
    export_deconstruction_to_note,
    stream_deconstruction_analysis,
)
from app.storage.database import get_session
from app.storage.models.deconstruction import Deconstruction
from app.storage.repos import deconstruction_repo

router = APIRouter(prefix="/deconstructions", tags=["deconstructions"])


@router.get("/prompt-template", summary="获取默认拆书提示词模板")
async def get_default_prompt_template() -> dict[str, str]:
    """返回内置的 22 维小说拆解分析师黄金提示词模板。"""
    return {"prompt_template": DEFAULT_DECONSTRUCTION_PROMPT}


@router.post(
    "/stream",
    summary="流式调用大模型执行深度拆书",
)
async def stream_deconstruction(
    payload: DeconstructionStreamRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> StreamingResponse:
    """
    提供小说正文/样章文本，通过 SSE 格式实时流式返回 22 维拆书分析报告。
    """
    logger.info(
        f"发起小说拆书分析: text_length={len(payload.text)}, model_id={payload.model_id}, provider_id={payload.provider_id}"
    )

    stream_generator = stream_deconstruction_analysis(
        session=session,
        text=payload.text,
        model_id=payload.model_id,
        provider_id=payload.provider_id,
        prompt_template=payload.prompt_template,
    )

    return StreamingResponse(
        stream_generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "",
    response_model=DeconstructionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="保存拆书分析报告",
)
async def save_deconstruction(
    payload: DeconstructionCreateRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DeconstructionResponse:
    """将拆解完成的分析报告持久化保存到历史记录中。"""
    preview = payload.source_preview or (payload.source_text[:500] if payload.source_text else "")
    word_count = payload.source_word_count or (len(payload.source_text) if payload.source_text else 0)

    deconstruction = Deconstruction(
        title=payload.title,
        source_title=payload.source_title,
        source_preview=preview,
        source_word_count=word_count,
        source_text=payload.source_text,
        model_id=payload.model_id,
        prompt_template=payload.prompt_template or DEFAULT_DECONSTRUCTION_PROMPT,
        report_markdown=payload.report_markdown,
    )

    saved = await deconstruction_repo.create(session, deconstruction)
    return DeconstructionResponse.model_validate(saved)


@router.get(
    "",
    response_model=DeconstructionListResponse,
    summary="获取拆书报告历史列表",
)
async def list_deconstructions(
    session: Annotated[AsyncSession, Depends(get_session)],
    search: Annotated[str | None, Query(description="按标题或原书名搜索")] = None,
    page: Annotated[int, Query(ge=1, description="页码")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="每页数量")] = 20,
) -> DeconstructionListResponse:
    """获取保存的拆书报告历史列表。"""
    items, total = await deconstruction_repo.list_deconstructions(
        session, search=search, page=page, page_size=page_size
    )
    return DeconstructionListResponse(
        items=[DeconstructionResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{deconstruction_id}",
    response_model=DeconstructionResponse,
    summary="获取单个拆书报告详情",
)
async def get_deconstruction(
    deconstruction_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DeconstructionResponse:
    """获取指定拆书分析报告的完整详情。"""
    record = await deconstruction_repo.get_by_id(session, deconstruction_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="拆书报告不存在",
        )
    return DeconstructionResponse.model_validate(record)


@router.delete(
    "/{deconstruction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除拆书报告",
)
async def delete_deconstruction(
    deconstruction_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """删除指定的拆书分析报告。"""
    deleted = await deconstruction_repo.delete(session, deconstruction_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="拆书报告不存在",
        )


@router.post(
    "/{deconstruction_id}/create-project",
    response_model=CreateProjectFromDeconstructionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="一键转化为新书项目 (仿写脚手架)",
)
async def create_project_from_report(
    deconstruction_id: str,
    payload: CreateProjectFromDeconstructionRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CreateProjectFromDeconstructionResponse:
    """
    根据拆书报告智能解析并一键生成全新小说仿写项目，
    自动预设世界观设定、人物角色卡、分卷与各章节大纲草稿。
    """
    try:
        project = await create_project_from_deconstruction(
            session=session,
            deconstruction_id=deconstruction_id,
            project_title=payload.title,
            project_description=payload.description,
        )
        return CreateProjectFromDeconstructionResponse(
            project_id=project.id,
            title=project.title,
        )
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.post(
    "/{deconstruction_id}/export-to-note",
    response_model=ExportToNoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="将拆书报告归档到指定项目笔记",
)
async def export_report_to_note(
    deconstruction_id: str,
    payload: ExportToNoteRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ExportToNoteResponse:
    """将拆解报告直接插入到已有小说的笔记参考资料中。"""
    try:
        note = await export_deconstruction_to_note(
            session=session,
            deconstruction_id=deconstruction_id,
            target_project_id=payload.project_id,
        )
        return ExportToNoteResponse(
            note_id=note.id,
            project_id=note.project_id,
            title=note.title,
        )
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
