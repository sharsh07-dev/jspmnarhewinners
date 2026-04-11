from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.exceptions import NotFoundError
from app.repositories.claims import ClaimRepository
from app.repositories.farms import FarmRepository
from app.schemas.auth import AuthenticatedUser
from app.schemas.claim import ClaimCreateRequest


class ClaimService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ClaimRepository(session)
        self.farms = FarmRepository(session)

    async def create_claim(self, payload: ClaimCreateRequest, *, farmer_user_id: int | None = None):
        farm_profile_id = payload.farm_profile_id
        farmer_name = payload.farmer_name
        area_hectares = payload.farm_area_hectares
        latitude = payload.latitude
        longitude = payload.longitude

        if farm_profile_id is not None:
            farm = await self.farms.get_by_id(farm_profile_id)
            if farm is None:
                raise NotFoundError(f"Farm profile '{farm_profile_id}' was not found.")
            farmer_name = farmer_name or farm.farmer_name
            area_hectares = float(farm.farm_area_hectares)
            latitude = float(farm.centroid_latitude)
            longitude = float(farm.centroid_longitude)

        claim = await self.repo.create(
            farmer_user_id=farmer_user_id,
            farm_profile_id=farm_profile_id,
            farmer_name=str(farmer_name),
            crop_type=payload.crop_type,
            farm_area_hectares=float(area_hectares),
            latitude=float(latitude),
            longitude=float(longitude),
            damage_date=payload.damage_date,
        )
        await self.session.commit()
        await self.session.refresh(claim)
        return claim

    async def list_claims(self, *, limit: int, offset: int, farmer_user_id: int | None = None):
        claims = await self.repo.list_claims(limit=limit, offset=offset, farmer_user_id=farmer_user_id)
        return claims

    async def get_claim_or_404(self, claim_id: int):
        claim = await self.repo.get_by_id(claim_id)
        if claim is None:
            raise NotFoundError(f"Claim '{claim_id}' was not found.")
        return claim

    async def submit_farmer_notes(self, *, claim_id: int, notes: str, current_user: AuthenticatedUser):
        if current_user.role != "farmer":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        claim = await self.get_claim_or_404(claim_id)
        if claim.farmer_user_id != current_user.farmer_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        claim.farmer_notes = notes
        claim.admin_status = "pending_review"
        claim.status = "created"

        await self.session.commit()
        await self.session.refresh(claim)
        return claim
