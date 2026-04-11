from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, redis_dep
from app.schemas.dashboard import DashboardHomeSignalsResponse, DashboardSummaryResponse
from app.services.dashboard import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_summary(
    session: AsyncSession = Depends(db_session_dep),
    redis_client: Redis = Depends(redis_dep),
) -> DashboardSummaryResponse:
    service = DashboardService(session, redis_client=redis_client)
    summary = await service.get_summary()
    return DashboardSummaryResponse(**summary)


@router.get("/home-signals", response_model=DashboardHomeSignalsResponse)
async def get_home_signals(
    location: str = Query(default="Pune"),
    days: int = Query(default=3, ge=1, le=5),
    session: AsyncSession = Depends(db_session_dep),
    redis_client: Redis = Depends(redis_dep),
) -> DashboardHomeSignalsResponse:
    service = DashboardService(session, redis_client=redis_client)
    payload = await service.get_home_signals(location=location, forecast_days=days)
    return DashboardHomeSignalsResponse(**payload)
