from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_admin_claims_filters_and_total_count(client, admin_headers) -> None:
    await client.post(
        "/api/v1/claims",
        json={
            "farmer_name": "Rahul Patil",
            "crop_type": "Wheat",
            "farm_area_hectares": 2.4,
            "latitude": 18.50,
            "longitude": 73.85,
            "damage_date": "2023-08-01",
        },
        headers=admin_headers,
    )
    await client.post(
        "/api/v1/claims",
        json={
            "farmer_name": "Neha Sharma",
            "crop_type": "Rice",
            "farm_area_hectares": 1.9,
            "latitude": 19.10,
            "longitude": 72.90,
            "damage_date": "2023-09-01",
        },
        headers=admin_headers,
    )

    filtered = await client.get(
        "/api/v1/admin/claims?limit=20&offset=0&crop_type=Wheat&search=rahul",
        headers=admin_headers,
    )
    assert filtered.status_code == 200
    body = filtered.json()
    assert body["total_count"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["farmer_name"] == "Rahul Patil"


@pytest.mark.asyncio
async def test_admin_full_and_bulk_review_creates_audit_log(client, admin_headers) -> None:
    create = await client.post(
        "/api/v1/claims",
        json={
            "farmer_name": "Bulk Owner",
            "crop_type": "Soybean",
            "farm_area_hectares": 2.0,
            "latitude": 18.40,
            "longitude": 73.70,
            "damage_date": "2023-07-10",
        },
        headers=admin_headers,
    )
    claim_id = create.json()["id"]

    bulk = await client.patch(
        "/api/v1/admin/claims/bulk-review",
        json={
            "claim_ids": [claim_id],
            "admin_status": "approved",
            "reviewed_by": "Admin QA",
            "admin_notes": "Bulk approval",
        },
        headers=admin_headers,
    )
    assert bulk.status_code == 200
    assert claim_id in bulk.json()["updated_claim_ids"]

    full = await client.get(f"/api/v1/admin/claims/{claim_id}/full", headers=admin_headers)
    assert full.status_code == 200
    body = full.json()
    assert body["claim"]["admin_status"] == "approved"
    assert len(body["audit_logs"]) >= 1
    assert body["audit_logs"][0]["new_status"] == "approved"
