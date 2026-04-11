from __future__ import annotations

import asyncio
import logging
import pickle
from datetime import datetime
from pathlib import Path

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.repositories.analysis import AnalysisRepository
from app.repositories.claims import ClaimRepository
from app.repositories.jobs import JobRepository
from app.services.ai_inference import AIInferenceService
from app.services.dashboard import DashboardService
from app.services.decisioning import DecisionService
from app.services.indices import compute_metrics
from app.services.satellite import SatelliteService
from app.utils.domain_helpers import ensure_dir

logger = logging.getLogger(__name__)


class AnalysisPipelineService:
    def __init__(self, session: AsyncSession, redis_client: Redis | None = None) -> None:
        self.session = session
        self.redis = redis_client
        self.settings = get_settings()
        self.claims = ClaimRepository(session)
        self.analysis = AnalysisRepository(session)
        self.jobs = JobRepository(session)
        self.satellite = SatelliteService(redis_client=redis_client)
        self.ai_inference = AIInferenceService()
        self.decision = DecisionService()
        self.dashboard = DashboardService(session, redis_client=redis_client)

    def _artifact_file_path(self, run_id: int) -> Path:
        artifacts_root = self.settings.artifacts_dir / "analysis"
        ensure_dir(artifacts_root)
        return artifacts_root / f"{run_id}.pkl"

    async def run(self, *, job_id: str, claim_id: int, params: dict) -> dict[str, int]:
        job_row = await self.jobs.get_by_id(job_id)
        if job_row is None:
            raise NotFoundError(f"Job '{job_id}' was not found.")

        claim = await self.claims.get_by_id(claim_id)
        if claim is None:
            raise NotFoundError(f"Claim '{claim_id}' was not found.")

        run = None
        run_id: int | None = None
        try:
            await self.jobs.update_status(row=job_row, status="running", progress=5)
            claim.status = "analysis_running"

            gap_before = int(params.get("gap_before", self.settings.default_gap_before_days))
            gap_after = int(params.get("gap_after", self.settings.default_gap_after_days))
            window_days = int(params.get("window_days", self.settings.default_window_days))
            max_cloud_threshold = int(params.get("max_cloud_threshold", self.settings.default_max_cloud_threshold))
            upscale_factor = int(params.get("upscale_factor", self.settings.default_upscale_factor))

            run = await self.analysis.create_run(
                claim_id=claim_id,
                gap_before=gap_before,
                gap_after=gap_after,
                window_days=window_days,
                max_cloud_threshold=max_cloud_threshold,
                status="queued",
            )
            run_id = run.id
            await self.analysis.mark_running(run)
            await self.jobs.update_status(
                row=job_row,
                status="running",
                progress=15,
                payload_json={"analysis_run_id": run_id},
            )
            await self.session.commit()

            before_scene, after_scene, status_message = await self.satellite.fetch_satellite_pair(
                latitude=float(claim.latitude),
                longitude=float(claim.longitude),
                damage_date=claim.damage_date.isoformat(),
                area_hectares=float(claim.farm_area_hectares),
                gap_before=gap_before,
                gap_after=gap_after,
                window_days=window_days,
                max_cloud_threshold=max_cloud_threshold,
                upscale_factor=upscale_factor,
            )
            await self.jobs.update_status(row=job_row, status="running", progress=55)

            metrics, maps = compute_metrics(before_scene.bands, after_scene.bands)
            ai_result = self.ai_inference.predict_v2(before_scene.rgb_image, after_scene.rgb_image)
            decision_result = self.decision.evaluate_claim(
                ndvi_before=metrics.ndvi_before,
                ndvi_after=metrics.ndvi_after,
                ndwi_before=metrics.ndwi_before,
                ndwi_after=metrics.ndwi_after,
                evi_before=metrics.evi_before,
                evi_after=metrics.evi_after,
                ai_damage_probability=ai_result.damage_probability,
                damaged_area_percentage=ai_result.damaged_area_percentage,
            )

            await self.analysis.save_metrics(
                analysis_run_id=run_id,
                ndvi_before=metrics.ndvi_before,
                ndvi_after=metrics.ndvi_after,
                ndwi_before=metrics.ndwi_before,
                ndwi_after=metrics.ndwi_after,
                evi_before=metrics.evi_before,
                evi_after=metrics.evi_after,
                damage_percentage=metrics.damage_percentage,
            )
            await self.analysis.save_ai_prediction(
                analysis_run_id=run_id,
                model_version=ai_result.model_version,
                predicted_class=ai_result.predicted_class,
                damage_probability=ai_result.damage_probability,
                damaged_area_percentage=ai_result.damaged_area_percentage,
                class_probabilities_json=ai_result.class_probabilities,
            )
            await self.analysis.save_decision(
                claim_id=claim_id,
                analysis_run_id=run_id,
                decision=decision_result.decision,
                confidence=decision_result.confidence,
                rationale=decision_result.rationale,
                rules_version=self.settings.rules_version,
                fused_damage=decision_result.fused_damage,
                ndvi_damage=decision_result.ndvi_damage,
                ndwi_damage=decision_result.ndwi_damage,
                evi_damage=decision_result.evi_damage,
                ai_damage=decision_result.ai_damage,
                area_score=decision_result.area_score,
            )
            await self.analysis.mark_completed(
                run,
                status_message=status_message,
                before_scene_date=datetime.strptime(before_scene.image_date, "%Y-%m-%d").date(),
                after_scene_date=datetime.strptime(after_scene.image_date, "%Y-%m-%d").date(),
                before_scene_source=before_scene.source,
                after_scene_source=after_scene.source,
            )
            claim.status = "analysis_completed"
            await self.jobs.update_status(
                row=job_row,
                status="completed",
                progress=100,
                payload_json={
                    "analysis_run_id": run_id,
                    "decision": decision_result.decision,
                    "damage_percentage": metrics.damage_percentage,
                },
            )
            await self.session.commit()
            await self.dashboard.invalidate_summary_cache()
            await self._cache_analysis_artifacts(
                run_id=run_id,
                before_rgb=before_scene.rgb_image,
                after_rgb=after_scene.rgb_image,
                maps=maps,
            )
            return {"analysis_run_id": run_id}
        except Exception as exc:
            logger.exception("Analysis pipeline failed for claim_id=%s job_id=%s", claim_id, job_id, exc_info=exc)
            await self.session.rollback()
            recovery_job = await self.jobs.get_by_id(job_id)
            if recovery_job is not None:
                await self.jobs.update_status(
                    row=recovery_job,
                    status="failed",
                    progress=100,
                    error_message=str(exc),
                )
            if run_id is not None:
                reload_run = await self.analysis.get_by_id(run_id)
                if reload_run is not None:
                    await self.analysis.mark_failed(reload_run, reason=str(exc))
            reload_claim = await self.claims.get_by_id(claim_id)
            if reload_claim is not None:
                reload_claim.status = "failed"
            await self.session.commit()
            raise

    async def _cache_analysis_artifacts(self, *, run_id: int, before_rgb, after_rgb, maps: dict) -> None:
        payload = {
            "before_rgb": before_rgb,
            "after_rgb": after_rgb,
            **maps,
        }

        # Persist artifacts so completed analyses remain viewable after cache expiry/restart.
        artifact_path = self._artifact_file_path(run_id)
        try:
            await asyncio.to_thread(artifact_path.write_bytes, pickle.dumps(payload))
        except Exception as exc:
            logger.debug("Skipping analysis artifact file write due to filesystem issue: %s", exc)

        if self.redis is None:
            return

        key = f"analysis:artifacts:{run_id}"
        try:
            await asyncio.wait_for(self.redis.setex(key, 7200, pickle.dumps(payload)), timeout=2)
        except Exception as exc:
            logger.debug("Skipping analysis artifact cache write due to Redis issue: %s", exc)

    async def load_analysis_artifacts(self, run_id: int) -> dict | None:
        key = f"analysis:artifacts:{run_id}"

        if self.redis is not None:
            try:
                raw = await asyncio.wait_for(self.redis.get(key), timeout=2)
                if raw:
                    return pickle.loads(raw)
            except Exception as exc:
                logger.debug("Skipping analysis artifact cache lookup due to Redis issue: %s", exc)

        artifact_path = self._artifact_file_path(run_id)
        if not artifact_path.exists():
            return None

        try:
            payload = pickle.loads(await asyncio.to_thread(artifact_path.read_bytes))
        except Exception as exc:
            logger.debug("Skipping analysis artifact file read due to filesystem issue: %s", exc)
            return None

        if self.redis is not None:
            try:
                await asyncio.wait_for(self.redis.setex(key, 7200, pickle.dumps(payload)), timeout=2)
            except Exception as exc:
                logger.debug("Skipping analysis artifact cache warm-up due to Redis issue: %s", exc)

        return payload
