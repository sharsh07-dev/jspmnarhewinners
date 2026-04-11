from __future__ import annotations

from collections.abc import AsyncGenerator

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.utils.cache import get_redis_client


async def db_session_dep() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def redis_dep() -> Redis:
    return get_redis_client()
