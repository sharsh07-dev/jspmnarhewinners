from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, redis_dep
from app.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="cropshield-backend",
        timestamp=datetime.now(tz=timezone.utc),
    )


@router.get("/ready", response_model=ReadinessResponse)
async def readiness(
    session: AsyncSession = Depends(db_session_dep),
    redis_client: Redis = Depends(redis_dep),
) -> ReadinessResponse:
    db_state = "ok"
    redis_state = "ok"

    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        db_state = "error"
    try:
        await redis_client.ping()
    except Exception:
        redis_state = "error"

    overall = "ok" if db_state == "ok" and redis_state == "ok" else "degraded"
    return ReadinessResponse(status=overall, database=db_state, redis=redis_state)
