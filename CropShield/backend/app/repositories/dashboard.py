from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Claim, Decision, IndexMetric


class DashboardRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def summary(self) -> dict[str, float | int]:
        summary_stmt = select(
            select(func.count(Claim.id)).scalar_subquery().label("total_claims"),
            select(func.count(Claim.id)).where(Claim.admin_status == "approved").scalar_subquery().label("approved_claims"),
            select(func.avg(IndexMetric.damage_percentage)).scalar_subquery().label("average_damage_percentage"),
            select(func.avg(Decision.confidence)).scalar_subquery().label("average_decision_confidence"),
        )

        row = (await self.session.execute(summary_stmt)).one()
        total = row.total_claims or 0
        approved = row.approved_claims or 0
        avg_damage = row.average_damage_percentage
        avg_conf = row.average_decision_confidence
        return {
            "total_claims": int(total),
            "approved_claims": int(approved),
            "average_damage_percentage": float(avg_damage or 0.0),
            "average_decision_confidence": float(avg_conf or 0.0),
        }
