from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.exc import OperationalError
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from datetime import timedelta


TEST_DB_PATH = Path(__file__).resolve().parent / "test_api.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_PATH.as_posix()}?timeout=30"
os.environ["SYNC_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}?timeout=30"
os.environ["REDIS_URL"] = "redis://unused:6379/0"
os.environ["CELERY_BROKER_URL"] = "memory://"
os.environ["CELERY_RESULT_BACKEND"] = "cache+memory://"
os.environ["ENABLE_EARTH_ENGINE"] = "false"
os.environ["ALLOW_DEMO_SATELLITE_FALLBACK"] = "true"
os.environ["REPORT_ARTIFACTS_DIR"] = str((Path(__file__).resolve().parents[2] / "data" / "artifacts").as_posix())
os.environ["JWT_SECRET"] = "test-secret"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD"] = "admin"
os.environ["GOOGLE_CLIENT_ID"] = "test-client-id.apps.googleusercontent.com"

from app.api.deps import db_session_dep, redis_dep  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.security import create_token  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.models import FarmerUser  # noqa: E402
from app.main import app  # noqa: E402
from app.workers.tasks import analyze_claim_task, generate_report_task  # noqa: E402


class DummyRedis:
    def __init__(self) -> None:
        self.store: dict[str, bytes] = {}

    async def get(self, key: str):
        return self.store.get(key)

    async def setex(self, key: str, _ttl: int, value):
        if isinstance(value, str):
            self.store[key] = value.encode("utf-8")
        else:
            self.store[key] = value
        return True

    async def delete(self, key: str):
        self.store.pop(key, None)
        return 1

    async def ping(self):
        return True

    async def close(self):
        return None


@pytest_asyncio.fixture(scope="session")
async def engine():
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except PermissionError:
            pass
    async_engine = create_async_engine(
        os.environ["DATABASE_URL"],
        future=True,
        connect_args={"timeout": 30},
    )
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_engine
    await async_engine.dispose()
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except PermissionError:
            pass


@pytest_asyncio.fixture
async def session_maker(engine):
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def reset_db(session_maker):
    for attempt in range(5):
        try:
            async with session_maker() as session:
                for table in reversed(Base.metadata.sorted_tables):
                    await session.execute(delete(table))
                await session.commit()
            break
        except OperationalError as exc:
            message = str(exc).lower()
            if "database is locked" in message and attempt < 4:
                await asyncio.sleep(0.1 * (attempt + 1))
                continue
            raise
    yield


@pytest_asyncio.fixture
async def redis_client():
    return DummyRedis()


@pytest_asyncio.fixture
async def client(session_maker, redis_client, monkeypatch) -> AsyncGenerator[AsyncClient, None]:
    async def _db_override():
        async with session_maker() as session:
            yield session

    async def _redis_override():
        return redis_client

    app.dependency_overrides[db_session_dep] = _db_override
    app.dependency_overrides[redis_dep] = _redis_override

    class DummyAsyncResult:
        id = "dummy"

    def _fake_apply_async(*args, **kwargs):
        return DummyAsyncResult()

    monkeypatch.setattr(analyze_claim_task, "apply_async", _fake_apply_async)
    monkeypatch.setattr(generate_report_task, "apply_async", _fake_apply_async)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as async_client:
        yield async_client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_headers() -> dict[str, str]:
    settings = get_settings()
    token = create_token(
        {"sub": settings.admin_username, "role": "admin", "name": settings.admin_username},
        settings.jwt_secret,
        timedelta(hours=1),
    )
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def farmer_headers(session_maker) -> dict[str, str]:
    settings = get_settings()
    async with session_maker() as session:
        farmer = FarmerUser(email="farmer@example.com", name="Farmer Example", picture_url=None)
        session.add(farmer)
        await session.commit()
        await session.refresh(farmer)
        farmer_id = farmer.id
    token = create_token(
        {
            "sub": "farmer@example.com",
            "role": "farmer",
            "farmer_id": farmer_id,
            "name": "Farmer Example",
            "email": "farmer@example.com",
        },
        settings.jwt_secret,
        timedelta(hours=1),
    )
    return {"Authorization": f"Bearer {token}"}
