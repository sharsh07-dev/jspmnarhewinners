from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.db.models import AnalysisRun, IndexMetric
from app.core.config import Settings, get_settings
from app.main import app


@pytest.mark.asyncio
async def test_weather_market_and_advisory_routes_return_200(client, admin_headers, session_maker) -> None:
    weather_resp = await client.get("/api/v1/weather/current?location=Pune", headers=admin_headers)
    assert weather_resp.status_code == 200
    weather_body = weather_resp.json()
    assert weather_body["location"] == "Pune"
    assert isinstance(weather_body["temperature_c"], float)

    market_resp = await client.get("/api/v1/market/commodities", headers=admin_headers)
    assert market_resp.status_code == 200
    market_body = market_resp.json()
    assert len(market_body["items"]) >= 1

    advisory_resp = await client.post(
        "/api/v1/advisory/chat",
        json={"message": "How should I irrigate wheat this week?", "language": "en"},
        headers=admin_headers,
    )
    assert advisory_resp.status_code == 200
    advisory_body = advisory_resp.json()
    assert advisory_body["provider"] in {"fallback", "grok", "groq"}

    crop_predict_resp = await client.post(
        "/api/v1/advisory/crop-predict",
        json={
            "crop_type": "rice",
            "soil_type": "loam",
            "rainfall_mm": 920,
            "temperature_c": 29,
        },
        headers=admin_headers,
    )
    assert crop_predict_resp.status_code == 200
    assert crop_predict_resp.json()["expected_yield_tph"] > 0

    claim_resp = await client.post(
        "/api/v1/claims",
        json={
            "farmer_name": "Finance Seed",
            "crop_type": "Rice",
            "farm_area_hectares": 3.5,
            "latitude": 18.5204,
            "longitude": 73.8567,
            "damage_date": "2023-09-01",
        },
        headers=admin_headers,
    )
    assert claim_resp.status_code == 201
    claim_id = claim_resp.json()["id"]

    async with session_maker() as session:
        analysis_run = AnalysisRun(
            claim_id=claim_id,
            status="completed",
            status_message="seeded financial summary test",
            gap_before=5,
            gap_after=5,
            window_days=10,
            max_cloud_threshold=100,
            started_at=datetime.now(tz=timezone.utc),
            completed_at=datetime.now(tz=timezone.utc),
        )
        session.add(analysis_run)
        await session.flush()
        session.add(
            IndexMetric(
                analysis_run_id=analysis_run.id,
                ndvi_before=0.81234,
                ndvi_after=0.42321,
                ndwi_before=0.11234,
                ndwi_after=0.06234,
                evi_before=0.70234,
                evi_after=0.31234,
                damage_percentage=38.5,
            )
        )
        await session.commit()

    review_resp = await client.patch(
        f"/api/v1/admin/claims/{claim_id}/review",
        json={
            "admin_status": "approved",
            "reviewed_by": "Admin User",
            "admin_notes": "Seeded for financial summary test",
            "recommended_insurance_amount": 45000,
        },
        headers=admin_headers,
    )
    assert review_resp.status_code == 200

    financial_resp = await client.get("/api/v1/market/financial-summary", headers=admin_headers)
    assert financial_resp.status_code == 200
    financial_body = financial_resp.json()
    assert financial_body["estimated_revenue_inr"] > 0
    assert financial_body["estimated_cost_inr"] > 0


@pytest.mark.asyncio
async def test_dashboard_home_signals_route_returns_200(client, admin_headers) -> None:
    response = await client.get("/api/v1/dashboard/home-signals?location=Pune&days=3", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()

    assert "summary" in body
    assert "weather_current" in body
    assert "weather_forecast" in body
    assert "weather_alerts" in body
    assert "market_commodities" in body
    assert "market_trending" in body
    assert "market_mandi_data" in body

    assert isinstance(body["summary"]["total_claims"], int)
    assert isinstance(body["weather_forecast"]["days"], list)
    assert isinstance(body["market_commodities"]["items"], list)


@pytest.mark.asyncio
async def test_forum_routes_create_and_search_posts(client, farmer_headers) -> None:
    create_resp = await client.post(
        "/api/v1/forum/posts",
        json={"title": "Pest issue in tomato", "content": "Leaves have spots after rain."},
        headers=farmer_headers,
    )
    assert create_resp.status_code == 200
    created = create_resp.json()
    post_id = created["id"]

    list_resp = await client.get("/api/v1/forum/posts", headers=farmer_headers)
    assert list_resp.status_code == 200
    assert any(item["id"] == post_id for item in list_resp.json()["items"])

    reply_resp = await client.post(
        f"/api/v1/forum/posts/{post_id}/replies",
        json={"content": "Try checking drainage and apply preventive spray."},
        headers=farmer_headers,
    )
    assert reply_resp.status_code == 200

    search_resp = await client.get("/api/v1/forum/search?query=tomato", headers=farmer_headers)
    assert search_resp.status_code == 200
    assert search_resp.json()["query"] == "tomato"


@pytest.mark.asyncio
async def test_forum_reply_to_missing_post_returns_404(client, farmer_headers) -> None:
    reply_resp = await client.post(
        "/api/v1/forum/posts/999999/replies",
        json={"content": "Any updates?"},
        headers=farmer_headers,
    )
    assert reply_resp.status_code == 404


@pytest.mark.asyncio
async def test_new_phase2_routes_require_auth(client) -> None:
    weather_resp = await client.get("/api/v1/weather/current")
    market_resp = await client.get("/api/v1/market/commodities")
    advisory_resp = await client.post("/api/v1/advisory/chat", json={"message": "x", "language": "en"})
    forum_resp = await client.get("/api/v1/forum/posts")
    disease_resp = await client.post("/api/v1/disease/detect", json={"image_name": "leaf.jpg"})

    assert weather_resp.status_code == 401
    assert market_resp.status_code == 401
    assert advisory_resp.status_code == 401
    assert forum_resp.status_code == 401
    assert disease_resp.status_code == 401


@pytest.mark.asyncio
async def test_disease_detect_route_returns_prediction(client, admin_headers) -> None:
    response = await client.post(
        "/api/v1/disease/detect",
        json={"image_name": "tomato_leaf_spot.jpg", "crop_type": "tomato"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["predicted_disease"]
    assert 0 <= body["confidence"] <= 1
    assert isinstance(body["recommendation"], str)


@pytest.mark.asyncio
async def test_feature_flag_disabled_routes_return_503(client, admin_headers) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        enable_weather_module=False,
        enable_market_module=False,
        enable_advisory_module=False,
    )

    try:
        weather_resp = await client.get("/api/v1/weather/current?location=Pune", headers=admin_headers)
        market_resp = await client.get("/api/v1/market/commodities", headers=admin_headers)
        advisory_resp = await client.post(
            "/api/v1/advisory/chat",
            json={"message": "test", "language": "en"},
            headers=admin_headers,
        )

        assert weather_resp.status_code == 503
        assert market_resp.status_code == 503
        assert advisory_resp.status_code == 503
        assert weather_resp.json()["detail"] == "Weather module disabled"
        assert market_resp.json()["detail"] == "Market module disabled"
        assert advisory_resp.json()["detail"] == "Advisory module disabled"
    finally:
        app.dependency_overrides.pop(get_settings, None)
