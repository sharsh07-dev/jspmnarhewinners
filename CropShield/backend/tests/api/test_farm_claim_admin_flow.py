from __future__ import annotations

import pytest

from app.db.models import FarmProfile


@pytest.mark.asyncio
async def test_create_claim_from_farm_profile_uses_saved_extent_center(client, session_maker, admin_headers) -> None:
    async with session_maker() as session:
        farm = FarmProfile(
            farmer_name="Kiran Jadhav",
            owner_names_json=["Kiran Jadhav"],
            survey_numbers_json=["12A"],
            area_values_json=["1.750"],
            automation_raw_text="demo",
            state_index=0,
            category_index=0,
            district_index=0,
            taluka_index=0,
            village_index=0,
            plot_index=0,
            state_name="MH",
            category_name="Rural",
            district_name="Pune",
            taluka_name="Haveli",
            village_name="Demo",
            plot_name="12A",
            extent_min_x=73.8560,
            extent_min_y=18.5200,
            extent_max_x=73.8570,
            extent_max_y=18.5210,
            extent_polygon_json=[
                [18.5200, 73.8560],
                [18.5200, 73.8570],
                [18.5210, 73.8570],
                [18.5210, 73.8560],
                [18.5200, 73.8560],
            ],
            centroid_latitude=18.5205,
            centroid_longitude=73.8565,
            farm_area_hectares=1.75,
            screenshot_path=None,
            automation_source="test",
            automation_status_message="ok",
            metadata_json={"test": True},
        )
        session.add(farm)
        await session.commit()
        await session.refresh(farm)
        farm_id = farm.id

    response = await client.post(
        "/api/v1/claims",
        json={
            "farm_profile_id": farm_id,
            "crop_type": "Rice",
            "damage_date": "2023-09-10",
        },
        headers=admin_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["farm_profile_id"] == farm_id
    assert body["farmer_name"] == "Kiran Jadhav"
    assert body["farm_area_hectares"] == pytest.approx(1.75, abs=1e-3)
    assert body["latitude"] == pytest.approx(18.5205, abs=1e-6)
    assert body["longitude"] == pytest.approx(73.8565, abs=1e-6)
    assert body["admin_status"] == "pending_review"


@pytest.mark.asyncio
async def test_admin_review_endpoint_updates_claim(client, admin_headers) -> None:
    create_resp = await client.post(
        "/api/v1/claims",
        json={
            "farmer_name": "Leena More",
            "crop_type": "Soybean",
            "farm_area_hectares": 2.4,
            "latitude": 18.5304,
            "longitude": 73.8467,
            "damage_date": "2023-09-01",
        },
        headers=admin_headers,
    )
    claim_id = create_resp.json()["id"]

    review_resp = await client.patch(
        f"/api/v1/admin/claims/{claim_id}/review",
        json={
            "admin_status": "approved",
            "reviewed_by": "Admin QA",
            "admin_notes": "Satellite and extent verified.",
            "recommended_insurance_amount": 14500,
        },
        headers=admin_headers,
    )
    assert review_resp.status_code == 200
    reviewed = review_resp.json()
    assert reviewed["claim_id"] == claim_id
    assert reviewed["admin_status"] == "approved"
    assert reviewed["reviewed_by"] == "Admin QA"
    assert reviewed["recommended_insurance_amount"] == pytest.approx(14500.0)
    assert reviewed["pmfby_reference_url"] == "https://pmfby.gov.in/"
