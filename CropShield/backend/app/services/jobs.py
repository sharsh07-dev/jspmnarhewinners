from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.db.models import JobStatus
from app.repositories.analysis import AnalysisRepository
from app.repositories.jobs import JobRepository
from app.repositories.reports import ReportRepository
from app.schemas.claim import AnalyzeClaimRequest
from app.schemas.report import ReportCreateRequest
from app.services.inline_runner import InlineJobRunner


class JobService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.settings = get_settings()
        self.jobs = JobRepository(session)
        self.analysis = AnalysisRepository(session)
        self.reports = ReportRepository(session)

    @staticmethod
    def _is_stale_active_job(updated_at: datetime, *, max_age_minutes: int = 10) -> bool:
        now = datetime.now(timezone.utc)
        timestamp = updated_at
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        return (now - timestamp) > timedelta(minutes=max_age_minutes)

    async def enqueue_analysis(self, *, claim_id: int, request: AnalyzeClaimRequest) -> JobStatus:
        existing = await self.jobs.get_active_job_for_resource(
            job_type="analysis",
            resource_type="claim",
            resource_id=claim_id,
        )
        if existing:
            if self._is_stale_active_job(existing.updated_at):
                await self.jobs.update_status(
                    row=existing,
                    status="failed",
                    progress=100,
                    error_message="Marked stale after no progress; re-queued automatically.",
                )
                await self.session.commit()
            else:
                return existing

        job_id = str(uuid4())
        payload = request.model_dump()
        row = await self.jobs.create(
            job_id=job_id,
            job_type="analysis",
            resource_type="claim",
            resource_id=claim_id,
            status="queued",
            progress=0,
            payload_json=payload,
        )
        await self.session.commit()
        if self.settings.enable_inline_jobs:
            InlineJobRunner.schedule_analysis(job_id=job_id, claim_id=claim_id, params=payload)
        else:
            from app.workers.tasks import analyze_claim_task

            analyze_claim_task.apply_async(
                kwargs={"job_id": job_id, "claim_id": claim_id, "params": payload},
                task_id=job_id,
            )
        return row

    async def enqueue_report(self, *, claim_id: int, request: ReportCreateRequest) -> JobStatus:
        existing = await self.jobs.get_active_job_for_resource(
            job_type="report",
            resource_type="claim",
            resource_id=claim_id,
        )
        if existing:
            if self._is_stale_active_job(existing.updated_at):
                await self.jobs.update_status(
                    row=existing,
                    status="failed",
                    progress=100,
                    error_message="Marked stale after no progress; re-queued automatically.",
                )
                await self.session.commit()
            else:
                return existing

        latest_analysis = await self.analysis.get_latest_for_claim(claim_id)
        if latest_analysis is None:
            raise NotFoundError(f"No analysis run found for claim '{claim_id}'.")

        analysis_run_id = request.analysis_run_id or latest_analysis.id
        job_id = str(uuid4())
        payload: dict[str, Any] = {"analysis_run_id": analysis_run_id}
        row = await self.jobs.create(
            job_id=job_id,
            job_type="report",
            resource_type="claim",
            resource_id=claim_id,
            status="queued",
            progress=0,
            payload_json=payload,
        )
        await self.session.commit()
        if self.settings.enable_inline_jobs:
            InlineJobRunner.schedule_report(
                job_id=job_id,
                claim_id=claim_id,
                analysis_run_id=analysis_run_id,
            )
        else:
            from app.workers.tasks import generate_report_task

            generate_report_task.apply_async(
                kwargs={"job_id": job_id, "claim_id": claim_id, "analysis_run_id": analysis_run_id},
                task_id=job_id,
            )
        return row

    async def get_job_or_404(self, job_id: str) -> JobStatus:
        row = await self.jobs.get_by_id(job_id)
        if row is None:
            raise NotFoundError(f"Job '{job_id}' was not found.")
        return row
