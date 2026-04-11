from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_create_and_get_claim(client, admin_headers) -> None:
    payload = {
        "farmer_name": "Ravi Patil",
        "crop_type": "Rice",
        "farm_area_hectares": 3.2,
        "latitude": 18.5204,
        "longitude": 73.8567,
        "damage_date": "2023-08-01",
    }
    create_response = await client.post("/api/v1/claims", json=payload, headers=admin_headers)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["farmer_name"] == "Ravi Patil"
    claim_id = created["id"]

    get_response = await client.get(f"/api/v1/claims/{claim_id}", headers=admin_headers)
    assert get_response.status_code == 200
    fetched = get_response.json()
    assert fetched["id"] == claim_id
    assert fetched["crop_type"] == "Rice"


@pytest.mark.asyncio
async def test_list_claims_returns_created_records(client, admin_headers) -> None:
    payload = {
        "farmer_name": "Asha Nair",
        "crop_type": "Wheat",
        "farm_area_hectares": 1.9,
        "latitude": 12.9716,
        "longitude": 77.5946,
        "damage_date": "2023-07-14",
    }
    await client.post("/api/v1/claims", json=payload, headers=admin_headers)
    response = await client.get("/api/v1/claims?limit=10&offset=0", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["limit"] == 10
    assert len(body["items"]) == 1
