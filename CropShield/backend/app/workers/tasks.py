from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.repositories.analysis import AnalysisRepository
from app.repositories.claims import ClaimRepository
from app.repositories.jobs import JobRepository
from app.services.analysis_pipeline import AnalysisPipelineService
from app.services.dashboard import DashboardService
from app.services.indices import compute_metrics
from app.services.reports import ReportService
from app.services.satellite import SatelliteService
from app.utils.cache import get_redis_client
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run(coro) -> Any:
    return asyncio.run(coro)


async def run_analysis_job(job_id: str, claim_id: int, params: dict[str, Any]) -> dict[str, Any]:
    redis_client = get_redis_client()
    async with AsyncSessionLocal() as session:
        pipeline = AnalysisPipelineService(session, redis_client=redis_client)
        result = await pipeline.run(job_id=job_id, claim_id=claim_id, params=params)
    return {"job_id": job_id, **result}


async def run_report_job(job_id: str, claim_id: int, analysis_run_id: int) -> dict[str, Any]:
    settings = get_settings()
    redis_client = get_redis_client()
    async with AsyncSessionLocal() as session:
        jobs = JobRepository(session)
        claims = ClaimRepository(session)
        analysis_repo = AnalysisRepository(session)
        report_service = ReportService(session, redis_client=redis_client)
        dashboard_service = DashboardService(session, redis_client=redis_client)
        pipeline = AnalysisPipelineService(session, redis_client=redis_client)

        job_row = await jobs.get_by_id(job_id)
        if job_row is None:
            raise ValueError(f"Job '{job_id}' was not found.")
        await jobs.update_status(row=job_row, status="running", progress=10)
        claim = await claims.get_by_id(claim_id)
        if claim is None:
            raise ValueError(f"Claim '{claim_id}' was not found.")

        analysis = await analysis_repo.get_by_id(analysis_run_id)
        if analysis is None:
            raise ValueError(f"Analysis run '{analysis_run_id}' was not found.")

        artifacts = await pipeline.load_analysis_artifacts(analysis_run_id)
        if artifacts is None:
            satellite = SatelliteService(redis_client=redis_client)
            before_scene, after_scene, _ = await satellite.fetch_satellite_pair(
                latitude=float(claim.latitude),
                longitude=float(claim.longitude),
                damage_date=claim.damage_date.isoformat(),
                area_hectares=float(claim.farm_area_hectares),
                gap_before=analysis.gap_before or settings.default_gap_before_days,
                gap_after=analysis.gap_after or settings.default_gap_after_days,
                window_days=analysis.window_days or settings.default_window_days,
                max_cloud_threshold=analysis.max_cloud_threshold or settings.default_max_cloud_threshold,
                upscale_factor=settings.default_upscale_factor,
            )
            _, maps = compute_metrics(before_scene.bands, after_scene.bands)
            artifacts = {
                "before_rgb": before_scene.rgb_image,
                "after_rgb": after_scene.rgb_image,
                **maps,
            }
        await jobs.update_status(row=job_row, status="running", progress=70)

        report = await report_service.generate_report(
            claim_id=claim_id,
            analysis_run_id=analysis_run_id,
            analysis_maps=artifacts,
        )
        claim.status = "report_ready"
        await jobs.update_status(
            row=job_row,
            status="completed",
            progress=100,
            payload_json={"report_id": report.id, "file_path": report.file_path_or_object_key},
        )
        await session.commit()
        await dashboard_service.invalidate_summary_cache()
        return {
            "job_id": job_id,
            "report_id": report.id,
            "file_path_or_object_key": report.file_path_or_object_key,
        }


@celery_app.task(name="app.workers.tasks.analyze_claim_task", bind=True)
def analyze_claim_task(self, job_id: str, claim_id: int, params: dict[str, Any]) -> dict[str, Any]:
    return _run(run_analysis_job(job_id=job_id, claim_id=claim_id, params=params))


@celery_app.task(name="app.workers.tasks.generate_report_task", bind=True)
def generate_report_task(self, job_id: str, claim_id: int, analysis_run_id: int) -> dict[str, Any]:
    try:
        return _run(run_report_job(job_id=job_id, claim_id=claim_id, analysis_run_id=analysis_run_id))
    except Exception as exc:
        async def _mark_failure() -> None:
            async with AsyncSessionLocal() as session:
                jobs = JobRepository(session)
                row = await jobs.get_by_id(job_id)
                if row is not None:
                    await jobs.update_status(row=row, status="failed", progress=100, error_message=str(exc))
                    await session.commit()

        _run(_mark_failure())
        raise
