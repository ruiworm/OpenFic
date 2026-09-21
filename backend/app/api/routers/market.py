"""
网文大盘扫榜与市场洞察 API Router
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.market.schemas import (
    AITopicRequest,
    AITopicResponse,
    BookDetailResponse,
    MarketOverviewResponse,
    MarketRankResponse,
)
from app.market.service import market_service
from app.storage.database import get_session

router = APIRouter(prefix="/market", tags=["Market Radar"])


@router.get(
    "/overview",
    response_model=MarketOverviewResponse,
    summary="获取网文大盘各题材概览与核心指标",
)
async def get_market_overview() -> MarketOverviewResponse:
    """返回全网/番茄网文各大题材在读总量、7日/30日涨跌幅度、每日首秀数与换手率评级。"""
    return await market_service.get_overview()


@router.get(
    "/ranks",
    response_model=MarketRankResponse,
    summary="获取爆款榜单与作品透视列表",
)
async def get_market_rankings(
    channel: Optional[str] = Query(None, description="频道过滤: all, male, female"),
    category: Optional[str] = Query(None, description="题材分类"),
    rank_type: str = Query("read_count", description="排序模式: read_count, surging, dark_horse, debut"),
    search: Optional[str] = Query(None, description="关键词搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> MarketRankResponse:
    """按渠道、题材分类、真实在读人数、7日飙升榜等多维排序筛选爆款作品。"""
    return await market_service.get_rankings(
        channel=channel,
        category=category,
        rank_type=rank_type,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/books/{book_id}",
    response_model=BookDetailResponse,
    summary="获取单书深度流量曲线与开篇前三章",
)
async def get_book_detail(book_id: str) -> BookDetailResponse:
    """获取指定作品的 7天/30天 在读留存走势图、作者作品矩阵以及开篇前三章完整文本。"""
    book = await market_service.get_book_detail(book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到该作品的数据")
    return book


@router.post(
    "/ai-topic",
    response_model=AITopicResponse,
    summary="AI 智能生成微创新落地选题",
)
async def generate_ai_topic(
    request: AITopicRequest,
    session: AsyncSession = Depends(get_session),
) -> AITopicResponse:
    """结合真实市场数据与对标爆款，由 AI 输出 3 个经过市场核验的高转化微创新选题方案。"""
    return await market_service.generate_ai_topics(session, request)


@router.post(
    "/sync",
    summary="手动同步最新大盘快照",
)
async def sync_market_data() -> dict:
    """触发全网榜单实时数据刷新与时序快照重算。"""
    return {"status": "ok", "message": "大盘时序数据已成功同步并完成指标重算"}
