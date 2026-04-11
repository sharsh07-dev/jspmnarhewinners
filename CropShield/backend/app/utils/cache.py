from __future__ import annotations

import hashlib
import json
from typing import Any

import redis.asyncio as redis

from app.core.config import get_settings


_redis_client: redis.Redis | None = None


def build_cache_key(prefix: str, payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"{prefix}:{digest}"


def get_redis_client() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = redis.from_url(
            settings.redis_url,
            decode_responses=False,
            socket_timeout=2,
            socket_connect_timeout=2,
        )
    return _redis_client


async def close_redis_client() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
