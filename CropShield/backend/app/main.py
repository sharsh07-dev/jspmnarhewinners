from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.utils.cache import close_redis_client, get_redis_client
from app.utils.domain_helpers import ensure_dir


settings = get_settings()
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_dir(settings.artifacts_dir)
    redis_client = get_redis_client()
    try:
        await redis_client.ping()
    except Exception:
        # Startup should not fail just because Redis is down; readiness endpoint captures degraded state.
        pass
    yield
    await close_redis_client()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)
register_exception_handlers(app)
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "docs_url": "/docs",
        "api_prefix": settings.api_v1_prefix,
    }
