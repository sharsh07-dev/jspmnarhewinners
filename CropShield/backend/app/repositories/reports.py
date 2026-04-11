from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Report


class ReportRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        claim_id: int,
        analysis_run_id: int,
        file_path_or_object_key: str,
        mime_type: str = "application/pdf",
    ) -> Report:
        report = Report(
            claim_id=claim_id,
            analysis_run_id=analysis_run_id,
            file_path_or_object_key=file_path_or_object_key,
            mime_type=mime_type,
        )
        self.session.add(report)
        await self.session.flush()
        return report

    async def get_latest_for_claim(self, claim_id: int) -> Report | None:
        stmt = select(Report).where(Report.claim_id == claim_id).order_by(Report.generated_at.desc()).limit(1)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
