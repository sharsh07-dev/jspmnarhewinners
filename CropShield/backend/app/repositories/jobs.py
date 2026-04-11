from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import JobStatus


class JobRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        job_id: str,
        job_type: str,
        resource_type: str,
        resource_id: int,
        status: str = "queued",
        progress: int = 0,
        payload_json: dict[str, Any] | None = None,
    ) -> JobStatus:
        row = JobStatus(
            id=job_id,
            job_type=job_type,
            resource_type=resource_type,
            resource_id=resource_id,
            status=status,
            progress=progress,
            payload_json=payload_json,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def get_by_id(self, job_id: str) -> JobStatus | None:
        stmt = select(JobStatus).where(JobStatus.id == job_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_job_for_resource(self, *, job_type: str, resource_type: str, resource_id: int) -> JobStatus | None:
        stmt = (
            select(JobStatus)
            .where(
                JobStatus.job_type == job_type,
                JobStatus.resource_type == resource_type,
                JobStatus.resource_id == resource_id,
                JobStatus.status.in_(["queued", "running"]),
            )
            .order_by(JobStatus.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_status(
        self,
        *,
        row: JobStatus,
        status: str,
        progress: int | None = None,
        payload_json: dict[str, Any] | None = None,
        error_message: str | None = None,
    ) -> JobStatus:
        row.status = status
        if progress is not None:
            row.progress = progress
        if payload_json is not None:
            row.payload_json = payload_json
        if error_message is not None:
            row.error_message = error_message
        await self.session.flush()
        return row
