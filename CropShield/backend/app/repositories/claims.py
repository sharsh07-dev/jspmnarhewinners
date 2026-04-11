from __future__ import annotations

from datetime import date

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import AnalysisRun, Claim


class ClaimRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        farmer_user_id: int | None,
        farm_profile_id: int | None,
        farmer_name: str,
        crop_type: str,
        farm_area_hectares: float,
        latitude: float,
        longitude: float,
        damage_date,
    ) -> Claim:
        claim = Claim(
            farmer_user_id=farmer_user_id,
            farm_profile_id=farm_profile_id,
            farmer_name=farmer_name,
            crop_type=crop_type,
            farm_area_hectares=farm_area_hectares,
            latitude=latitude,
            longitude=longitude,
            damage_date=damage_date,
            status="created",
            admin_status="pending_review",
        )
        self.session.add(claim)
        await self.session.flush()
        return claim

    async def list_claims(self, *, limit: int, offset: int, farmer_user_id: int | None = None) -> list[Claim]:
        stmt: Select[tuple[Claim]] = (
            select(Claim)
            .options(selectinload(Claim.farm_profile))
            .order_by(Claim.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if farmer_user_id is not None:
            stmt = stmt.where(Claim.farmer_user_id == farmer_user_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, claim_id: int) -> Claim | None:
        stmt = (
            select(Claim)
            .where(Claim.id == claim_id)
            .options(
                selectinload(Claim.analysis_runs).selectinload(AnalysisRun.metrics),
                selectinload(Claim.analysis_runs).selectinload(AnalysisRun.ai_prediction),
                selectinload(Claim.analysis_runs).selectinload(AnalysisRun.decisions),
                selectinload(Claim.decisions),
                selectinload(Claim.reports),
                selectinload(Claim.farm_profile),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_status(self, claim: Claim, status: str) -> Claim:
        claim.status = status
        await self.session.flush()
        return claim

    async def list_for_admin(
        self,
        *,
        limit: int,
        offset: int,
        status: str | None = None,
        admin_status: str | None = None,
        crop_type: str | None = None,
        damage_date_from: date | None = None,
        damage_date_to: date | None = None,
        search: str | None = None,
    ) -> tuple[list[Claim], int]:
        filters = []
        if status:
            filters.append(Claim.status == status)
        if admin_status:
            filters.append(Claim.admin_status == admin_status)
        if crop_type:
            filters.append(func.lower(Claim.crop_type) == crop_type.strip().lower())
        if damage_date_from is not None:
            filters.append(Claim.damage_date >= damage_date_from)
        if damage_date_to is not None:
            filters.append(Claim.damage_date <= damage_date_to)
        if search:
            pattern = f"%{search.strip()}%"
            filters.append(or_(Claim.farmer_name.ilike(pattern), Claim.crop_type.ilike(pattern)))

        stmt: Select[tuple[Claim]] = (
            select(Claim)
            .options(
                selectinload(Claim.farm_profile),
                selectinload(Claim.analysis_runs).selectinload(AnalysisRun.metrics),
                selectinload(Claim.analysis_runs).selectinload(AnalysisRun.ai_prediction),
            )
            .order_by(Claim.updated_at.desc(), Claim.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        count_stmt = select(func.count()).select_from(Claim)
        if filters:
            stmt = stmt.where(*filters)
            count_stmt = count_stmt.where(*filters)

        result = await self.session.execute(stmt)
        count_result = await self.session.execute(count_stmt)
        total_count = int(count_result.scalar_one())
        return list(result.scalars().all()), total_count

    async def get_for_admin_full(self, claim_id: int) -> Claim | None:
        stmt = (
            select(Claim)
            .where(Claim.id == claim_id)
            .options(
                selectinload(Claim.farm_profile),
                selectinload(Claim.analysis_runs).selectinload(AnalysisRun.metrics),
                selectinload(Claim.analysis_runs).selectinload(AnalysisRun.ai_prediction),
                selectinload(Claim.analysis_runs).selectinload(AnalysisRun.decisions),
                selectinload(Claim.audit_logs),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
