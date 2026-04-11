from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models import ClaimAuditLog
from app.repositories.claims import ClaimRepository
from app.schemas.admin import AdminBulkReviewRequest, AdminClaimReviewRequest


def classify_risk(damage_percentage: float) -> str:
    if damage_percentage >= 40.0:
        return "High possible crop damage"
    if damage_percentage >= 20.0:
        return "Moderate possible crop damage"
    return "Low possible crop damage"


class AdminService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.claims = ClaimRepository(session)

    async def list_claims(
        self,
        *,
        limit: int,
        offset: int,
        status: str | None,
        admin_status: str | None,
        crop_type: str | None,
        damage_date_from: date | None,
        damage_date_to: date | None,
        search: str | None,
    ):
        return await self.claims.list_for_admin(
            limit=limit,
            offset=offset,
            status=status,
            admin_status=admin_status,
            crop_type=crop_type,
            damage_date_from=damage_date_from,
            damage_date_to=damage_date_to,
            search=search,
        )

    async def get_claim_full_or_404(self, claim_id: int):
        claim = await self.claims.get_for_admin_full(claim_id)
        if claim is None:
            raise NotFoundError(f"Claim '{claim_id}' was not found.")
        return claim

    async def _apply_review_fields(self, claim, payload: AdminClaimReviewRequest | AdminBulkReviewRequest) -> None:
        old_status = claim.admin_status
        claim.admin_status = payload.admin_status
        claim.reviewed_by = payload.reviewed_by
        claim.admin_notes = payload.admin_notes
        claim.recommended_insurance_amount = payload.recommended_insurance_amount
        claim.reviewed_at = datetime.now(tz=timezone.utc)

        if payload.admin_status == "approved":
            claim.status = "approved_by_admin"
        elif payload.admin_status == "rejected":
            claim.status = "rejected_by_admin"
        elif payload.admin_status == "needs_more_info":
            claim.status = "needs_more_info"
        else:
            claim.status = "pending_admin_review"

        self.session.add(
            ClaimAuditLog(
                claim_id=claim.id,
                actor=payload.reviewed_by,
                action="review_claim",
                old_status=old_status,
                new_status=payload.admin_status,
                notes=payload.admin_notes,
            )
        )

    async def review_claim(self, *, claim_id: int, payload: AdminClaimReviewRequest):
        claim = await self.claims.get_by_id(claim_id)
        if claim is None:
            raise NotFoundError(f"Claim '{claim_id}' was not found.")

        await self._apply_review_fields(claim, payload)
        await self.session.commit()
        await self.session.refresh(claim)
        return claim

    async def bulk_review_claims(self, payload: AdminBulkReviewRequest) -> list[int]:
        updated_ids: list[int] = []
        for claim_id in payload.claim_ids:
            claim = await self.claims.get_by_id(claim_id)
            if claim is None:
                continue
            await self._apply_review_fields(claim, payload)
            updated_ids.append(claim.id)

        await self.session.commit()
        return updated_ids
