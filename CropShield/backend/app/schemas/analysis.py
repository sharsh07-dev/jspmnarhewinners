from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class IndexMetricsRead(BaseModel):
    ndvi_before: float
    ndvi_after: float
    ndwi_before: float
    ndwi_after: float
    evi_before: float
    evi_after: float
    damage_percentage: float


class AIPredictionRead(BaseModel):
    model_version: str
    predicted_class: str
    damage_probability: float
    damaged_area_percentage: float
    class_probabilities: dict[str, float] | None = None


class DecisionRead(BaseModel):
    decision: str
    confidence: float
    rationale: str
    rules_version: str
    fused_damage: float
    ndvi_damage: float
    ndwi_damage: float
    evi_damage: float
    ai_damage: float
    area_score: float


class DamageAssessmentRead(BaseModel):
    possible_damage_percentage: float
    risk_level: str
    summary: str


class AnalysisRunRead(BaseModel):
    id: int
    claim_id: int
    status: str
    status_message: str | None = None
    gap_before: int
    gap_after: int
    window_days: int
    max_cloud_threshold: int
    before_scene_date: date | None = None
    after_scene_date: date | None = None
    before_scene_source: str | None = None
    after_scene_source: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    metrics: IndexMetricsRead | None = None
    ai_prediction: AIPredictionRead | None = None
    decision: DecisionRead | None = None
    farmer_assessment: DamageAssessmentRead | None = None


class ClaimAnalysisResponse(BaseModel):
    claim_id: int
    analysis: AnalysisRunRead | None = None


class AnalysisArtifactsResponse(BaseModel):
    claim_id: int
    analysis_run_id: int
    before_rgb_data_url: str
    after_rgb_data_url: str
    ndvi_before_data_url: str
    ndvi_after_data_url: str
    ndwi_before_data_url: str
    ndwi_after_data_url: str
    evi_before_data_url: str
    evi_after_data_url: str
