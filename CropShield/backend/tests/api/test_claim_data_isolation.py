from __future__ import annotations

from datetime import timedelta

import pytest

from app.core.config import get_settings
from app.core.security import create_token
from app.db.models import Claim, FarmerUser


def _farmer_headers(*, farmer_id: int, email: str) -> dict[str, str]:
    settings = get_settings()
    token = create_token(
        {
            "sub": email,
            "role": "farmer",
            "farmer_id": farmer_id,
            "name": email,
            "email": email,
        },
        settings.jwt_secret,
        timedelta(hours=1),
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_farmer_claim_list_is_scoped_to_owner(client, session_maker, admin_headers) -> None:
    async with session_maker() as session:
        f1 = FarmerUser(email="f1@example.com", name="Farmer 1", picture_url=None)
        f2 = FarmerUser(email="f2@example.com", name="Farmer 2", picture_url=None)
        session.add_all([f1, f2])
        await session.commit()
        await session.refresh(f1)
        await session.refresh(f2)
        f1_id = f1.id
        f2_id = f2.id

    f1_headers = _farmer_headers(farmer_id=f1_id, email="f1@example.com")
    f2_headers = _farmer_headers(farmer_id=f2_id, email="f2@example.com")

    payload = {
        "farmer_name": "Owner",
        "crop_type": "Rice",
        "farm_area_hectares": 1.2,
        "latitude": 18.52,
        "longitude": 73.85,
        "damage_date": "2023-08-01",
    }

    create_f1 = await client.post("/api/v1/claims", json=payload, headers=f1_headers)
    assert create_f1.status_code == 201
    claim_f1_id = create_f1.json()["id"]

    create_f2 = await client.post("/api/v1/claims", json=payload, headers=f2_headers)
    assert create_f2.status_code == 201
    claim_f2_id = create_f2.json()["id"]

    list_f1 = await client.get("/api/v1/claims?limit=10&offset=0", headers=f1_headers)
    assert list_f1.status_code == 200
    items_f1 = list_f1.json()["items"]
    assert len(items_f1) == 1
    assert items_f1[0]["id"] == claim_f1_id

    list_admin = await client.get("/api/v1/claims?limit=10&offset=0", headers=admin_headers)
    assert list_admin.status_code == 200
    admin_ids = {item["id"] for item in list_admin.json()["items"]}
    assert claim_f1_id in admin_ids
    assert claim_f2_id in admin_ids


@pytest.mark.asyncio
async def test_farmer_cannot_access_or_analyze_other_farmer_claim(client, session_maker) -> None:
    async with session_maker() as session:
        f1 = FarmerUser(email="owner@example.com", name="Owner", picture_url=None)
        f2 = FarmerUser(email="other@example.com", name="Other", picture_url=None)
        session.add_all([f1, f2])
        await session.commit()
        await session.refresh(f1)
        await session.refresh(f2)

    owner_headers = _farmer_headers(farmer_id=f1.id, email="owner@example.com")
    other_headers = _farmer_headers(farmer_id=f2.id, email="other@example.com")

    payload = {
        "farmer_name": "Owner",
        "crop_type": "Wheat",
        "farm_area_hectares": 2.0,
        "latitude": 19.0,
        "longitude": 72.8,
        "damage_date": "2023-07-10",
    }

    created = await client.post("/api/v1/claims", json=payload, headers=owner_headers)
    assert created.status_code == 201
    claim_id = created.json()["id"]

    foreign_get = await client.get(f"/api/v1/claims/{claim_id}", headers=other_headers)
    assert foreign_get.status_code == 403

    foreign_analyze = await client.post(
        f"/api/v1/claims/{claim_id}/analyze",
        json={"gap_before": 5, "gap_after": 5, "window_days": 10, "max_cloud_threshold": 100, "upscale_factor": 2},
        headers=other_headers,
    )
    assert foreign_analyze.status_code == 403


@pytest.mark.asyncio
async def test_farmer_notes_submission_resets_claim_to_pending_review(client, session_maker) -> None:
    async with session_maker() as session:
        owner = FarmerUser(email="owner2@example.com", name="Owner 2", picture_url=None)
        other = FarmerUser(email="other2@example.com", name="Other 2", picture_url=None)
        session.add_all([owner, other])
        await session.commit()
        await session.refresh(owner)
        await session.refresh(other)
        owner_id = owner.id
        other_id = other.id

    owner_headers = _farmer_headers(farmer_id=owner_id, email="owner2@example.com")
    other_headers = _farmer_headers(farmer_id=other_id, email="other2@example.com")

    payload = {
        "farmer_name": "Owner 2",
        "crop_type": "Soybean",
        "farm_area_hectares": 2.8,
        "latitude": 18.11,
        "longitude": 74.10,
        "damage_date": "2023-08-17",
    }
    created = await client.post("/api/v1/claims", json=payload, headers=owner_headers)
    assert created.status_code == 201
    claim_id = created.json()["id"]

    async with session_maker() as session:
        claim = await session.get(Claim, claim_id)
        assert claim is not None
        claim.admin_status = "needs_more_info"
        claim.status = "needs_more_info"
        claim.admin_notes = "Please share pesticide usage details."
        await session.commit()

    submit = await client.patch(
        f"/api/v1/claims/{claim_id}/farmer-notes",
        json={"notes": "Used organic spray on 2023-08-10."},
        headers=owner_headers,
    )
    assert submit.status_code == 200
    body = submit.json()
    assert body["farmer_notes"] == "Used organic spray on 2023-08-10."
    assert body["admin_status"] == "pending_review"
    assert body["status"] == "created"

    denied = await client.patch(
        f"/api/v1/claims/{claim_id}/farmer-notes",
        json={"notes": "Trying to edit someone else's claim."},
        headers=other_headers,
    )
    assert denied.status_code == 403
