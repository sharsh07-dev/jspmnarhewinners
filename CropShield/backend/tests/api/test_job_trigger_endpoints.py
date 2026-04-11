from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.db.models import AnalysisRun


@pytest.mark.asyncio
async def test_analyze_job_trigger_returns_202_and_job(client, admin_headers) -> None:
    create_resp = await client.post(
        "/api/v1/claims",
        json={
            "farmer_name": "Vikram Rao",
            "crop_type": "Cotton",
            "farm_area_hectares": 4.0,
            "latitude": 19.0760,
            "longitude": 72.8777,
            "damage_date": "2023-09-01",
        },
        headers=admin_headers,
    )
    claim_id = create_resp.json()["id"]

    analyze_resp = await client.post(
        f"/api/v1/claims/{claim_id}/analyze",
        json={"gap_before": 5, "gap_after": 5, "window_days": 10, "max_cloud_threshold": 100, "upscale_factor": 2},
        headers=admin_headers,
    )
    assert analyze_resp.status_code == 202
    job_id = analyze_resp.json()["job_id"]

    job_resp = await client.get(f"/api/v1/jobs/{job_id}")
    assert job_resp.status_code == 200
    assert job_resp.json()["job_type"] == "analysis"


@pytest.mark.asyncio
async def test_report_job_trigger_returns_202_when_analysis_exists(client, session_maker, admin_headers) -> None:
    create_resp = await client.post(
        "/api/v1/claims",
        json={
            "farmer_name": "Meena Das",
            "crop_type": "Soybean",
            "farm_area_hectares": 2.2,
            "latitude": 23.0225,
            "longitude": 72.5714,
            "damage_date": "2023-06-11",
        },
        headers=admin_headers,
    )
    claim_id = create_resp.json()["id"]

    async with session_maker() as session:
        session.add(
            AnalysisRun(
                claim_id=claim_id,
                status="completed",
                status_message="test seed",
                gap_before=5,
                gap_after=5,
                window_days=10,
                max_cloud_threshold=100,
                started_at=datetime.now(tz=timezone.utc),
                completed_at=datetime.now(tz=timezone.utc),
            )
        )
        await session.commit()

    report_resp = await client.post(f"/api/v1/claims/{claim_id}/report", json={}, headers=admin_headers)
    assert report_resp.status_code == 202
    job_id = report_resp.json()["job_id"]
    job_resp = await client.get(f"/api/v1/jobs/{job_id}")
    assert job_resp.status_code == 200
    assert job_resp.json()["job_type"] == "report"
