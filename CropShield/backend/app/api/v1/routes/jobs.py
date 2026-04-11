from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep
from app.schemas.job import JobStatusResponse
from app.services.jobs import JobService

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _to_job_response(row) -> JobStatusResponse:
    return JobStatusResponse(
        id=row.id,
        job_type=row.job_type,
        resource_type=row.resource_type,
        resource_id=row.resource_id,
        status=row.status,
        progress=row.progress,
        payload_json=row.payload_json,
        error_message=row.error_message,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str, session: AsyncSession = Depends(db_session_dep)) -> JobStatusResponse:
    service = JobService(session)
    row = await service.get_job_or_404(job_id)
    return _to_job_response(row)


@router.get("/{job_id}/events")
async def stream_job_status_events(
    job_id: str,
    request: Request,
    session: AsyncSession = Depends(db_session_dep),
) -> StreamingResponse:
    service = JobService(session)
    await service.get_job_or_404(job_id)

    async def event_generator():
        last_signature: tuple[str, int, str] | None = None
        keepalive_ticks = 0

        while True:
            if await request.is_disconnected():
                break

            row = await service.get_job_or_404(job_id)
            job = _to_job_response(row)
            payload = job.model_dump(mode="json")
            signature = (job.status, job.progress, job.updated_at.isoformat())

            if signature != last_signature:
                event_name = "snapshot" if last_signature is None else "job"
                if job.status in {"completed", "failed"}:
                    event_name = job.status
                yield _sse_event(event_name, payload)
                last_signature = signature
            else:
                keepalive_ticks += 1
                if keepalive_ticks % 15 == 0:
                    yield ": keep-alive\n\n"

            if job.status in {"completed", "failed"}:
                break

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
