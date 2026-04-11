from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.db.models import FarmerUser


@pytest.mark.asyncio
async def test_admin_login_returns_bearer_token(client) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str)
    assert len(body["access_token"]) > 10


@pytest.mark.asyncio
async def test_admin_login_rejects_invalid_credentials(client) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "wrong"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_farmer_login_upserts_farmer_user(client, session_maker, monkeypatch) -> None:
    from app.services import auth as auth_service_module

    def _fake_verify_oauth2_token(id_token, request, audience):
        return {
            "email": "farmer@example.com",
            "name": "Farmer Example",
            "picture": "https://example.com/farmer.png",
        }

    monkeypatch.setattr(auth_service_module.google_id_token, "verify_oauth2_token", _fake_verify_oauth2_token)

    response = await client.post(
        "/api/v1/auth/farmer-login",
        json={"id_token": "google-test-token"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str)

    async with session_maker() as session:
        result = await session.execute(FarmerUser.__table__.select().where(FarmerUser.email == "farmer@example.com"))
        row = result.mappings().one()
        assert row["email"] == "farmer@example.com"
        assert row["name"] == "Farmer Example"
        assert row["picture_url"] == "https://example.com/farmer.png"
