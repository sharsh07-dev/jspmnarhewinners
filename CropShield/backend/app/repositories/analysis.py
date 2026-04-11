from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.db.models import AIPrediction, AnalysisRun, Decision, IndexMetric


class AnalysisRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_run(
        self,
        *,
        claim_id: int,
        gap_before: int,
        gap_after: int,
        window_days: int,
        max_cloud_threshold: int,
        status: str = "queued",
    ) -> AnalysisRun:
        run = AnalysisRun(
            claim_id=claim_id,
            gap_before=gap_before,
            gap_after=gap_after,
            window_days=window_days,
            max_cloud_threshold=max_cloud_threshold,
            status=status,
        )
        self.session.add(run)
        await self.session.flush()
        return run

    async def get_latest_for_claim(self, claim_id: int) -> AnalysisRun | None:
        stmt = (
            select(AnalysisRun)
            .where(AnalysisRun.claim_id == claim_id)
            .order_by(AnalysisRun.created_at.desc())
            .limit(1)
            .options(
                joinedload(AnalysisRun.metrics),
                joinedload(AnalysisRun.ai_prediction),
            )
        )
        result = await self.session.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def get_by_id(self, analysis_run_id: int) -> AnalysisRun | None:
        stmt = (
            select(AnalysisRun)
            .where(AnalysisRun.id == analysis_run_id)
            .options(
                joinedload(AnalysisRun.metrics),
                joinedload(AnalysisRun.ai_prediction),
                joinedload(AnalysisRun.decisions),
                joinedload(AnalysisRun.reports),
            )
        )
        result = await self.session.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def mark_running(self, run: AnalysisRun) -> AnalysisRun:
        run.status = "running"
        run.started_at = datetime.now(tz=timezone.utc)
        await self.session.flush()
        return run

    async def mark_completed(
        self,
        run: AnalysisRun,
        *,
        status_message: str,
        before_scene_date,
        after_scene_date,
        before_scene_source: str,
        after_scene_source: str,
    ) -> AnalysisRun:
        run.status = "completed"
        run.status_message = status_message
        run.before_scene_date = before_scene_date
        run.after_scene_date = after_scene_date
        run.before_scene_source = before_scene_source
        run.after_scene_source = after_scene_source
        run.completed_at = datetime.now(tz=timezone.utc)
        await self.session.flush()
        return run

    async def mark_failed(self, run: AnalysisRun, reason: str) -> AnalysisRun:
        run.status = "failed"
        run.status_message = reason
        run.completed_at = datetime.now(tz=timezone.utc)
        await self.session.flush()
        return run

    async def save_metrics(
        self,
        *,
        analysis_run_id: int,
        ndvi_before: float,
        ndvi_after: float,
        ndwi_before: float,
        ndwi_after: float,
        evi_before: float,
        evi_after: float,
        damage_percentage: float,
    ) -> IndexMetric:
        metric = IndexMetric(
            analysis_run_id=analysis_run_id,
            ndvi_before=ndvi_before,
            ndvi_after=ndvi_after,
            ndwi_before=ndwi_before,
            ndwi_after=ndwi_after,
            evi_before=evi_before,
            evi_after=evi_after,
            damage_percentage=damage_percentage,
        )
        self.session.add(metric)
        await self.session.flush()
        return metric

    async def save_ai_prediction(
        self,
        *,
        analysis_run_id: int,
        model_version: str,
        predicted_class: str,
        damage_probability: float,
        damaged_area_percentage: float,
        class_probabilities_json: dict[str, float] | None,
    ) -> AIPrediction:
        prediction = AIPrediction(
            analysis_run_id=analysis_run_id,
            model_version=model_version,
            predicted_class=predicted_class,
            damage_probability=damage_probability,
            damaged_area_percentage=damaged_area_percentage,
            class_probabilities_json=class_probabilities_json,
        )
        self.session.add(prediction)
        await self.session.flush()
        return prediction

    async def save_decision(
        self,
        *,
        claim_id: int,
        analysis_run_id: int,
        decision: str,
        confidence: float,
        rationale: str,
        rules_version: str,
        fused_damage: float,
        ndvi_damage: float,
        ndwi_damage: float,
        evi_damage: float,
        ai_damage: float,
        area_score: float,
    ) -> Decision:
        decision_row = Decision(
            claim_id=claim_id,
            analysis_run_id=analysis_run_id,
            decision=decision,
            confidence=confidence,
            rationale=rationale,
            rules_version=rules_version,
            fused_damage=fused_damage,
            ndvi_damage=ndvi_damage,
            ndwi_damage=ndwi_damage,
            evi_damage=evi_damage,
            ai_damage=ai_damage,
            area_score=area_score,
        )
        self.session.add(decision_row)
        await self.session.flush()
        return decision_row
