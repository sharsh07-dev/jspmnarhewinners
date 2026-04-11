from __future__ import annotations

import base64
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, redis_dep
from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.core.security import get_current_user
from app.db.models import AnalysisRun
from app.schemas.auth import AuthenticatedUser
from app.schemas.analysis import (
    AIPredictionRead,
    AnalysisArtifactsResponse,
    AnalysisRunRead,
    ClaimAnalysisResponse,
    DamageAssessmentRead,
    DecisionRead,
    IndexMetricsRead,
)
from app.schemas.claim import (
    AnalyzeClaimRequest,
    ClaimCreateRequest,
    ClaimListResponse,
    ClaimRead,
    FarmerNotesRequest,
    JobAcceptedResponse,
)
from app.schemas.report import ReportCreateRequest, ReportMetadataResponse
from app.services.analysis_pipeline import AnalysisPipelineService
from app.services.claims import ClaimService
from app.services.dashboard import DashboardService
from app.services.indices import compute_metrics
from app.services.jobs import JobService
from app.services.reports import ReportService
from app.services.satellite import SatelliteService
from app.utils.domain_helpers import array_to_clean_png_bytes, array_to_png_bytes

router = APIRouter(prefix="/claims", tags=["claims"])


def _assert_claim_access_or_403(claim, current_user: AuthenticatedUser) -> None:
    if current_user.role == "farmer" and claim.farmer_user_id != current_user.farmer_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _risk_label(damage_percentage: float) -> str:
    if damage_percentage >= 40:
        return "High possible crop damage"
    if damage_percentage >= 20:
        return "Moderate possible crop damage"
    return "Low possible crop damage"


def _to_claim_schema(claim) -> ClaimRead:
    return ClaimRead(
        id=claim.id,
        farm_profile_id=claim.farm_profile_id,
        farmer_name=claim.farmer_name,
        crop_type=claim.crop_type,
        farm_area_hectares=float(claim.farm_area_hectares),
        latitude=float(claim.latitude),
        longitude=float(claim.longitude),
        damage_date=claim.damage_date,
        status=claim.status,
        admin_status=claim.admin_status,
        admin_notes=claim.admin_notes,
        farmer_notes=claim.farmer_notes,
        reviewed_by=claim.reviewed_by,
        recommended_insurance_amount=(
            float(claim.recommended_insurance_amount) if claim.recommended_insurance_amount is not None else None
        ),
        pmfby_reference_url=claim.pmfby_reference_url,
        reviewed_at=claim.reviewed_at,
        created_at=claim.created_at,
        updated_at=claim.updated_at,
    )


def _to_analysis_schema(analysis: AnalysisRun | None) -> AnalysisRunRead | None:
    if analysis is None:
        return None
    metrics = None
    if analysis.metrics is not None:
        metrics = IndexMetricsRead(
            ndvi_before=float(analysis.metrics.ndvi_before),
            ndvi_after=float(analysis.metrics.ndvi_after),
            ndwi_before=float(analysis.metrics.ndwi_before),
            ndwi_after=float(analysis.metrics.ndwi_after),
            evi_before=float(analysis.metrics.evi_before),
            evi_after=float(analysis.metrics.evi_after),
            damage_percentage=float(analysis.metrics.damage_percentage),
        )

    ai_prediction = None
    if analysis.ai_prediction is not None:
        ai_prediction = AIPredictionRead(
            model_version=analysis.ai_prediction.model_version,
            predicted_class=analysis.ai_prediction.predicted_class,
            damage_probability=float(analysis.ai_prediction.damage_probability),
            damaged_area_percentage=float(analysis.ai_prediction.damaged_area_percentage),
            class_probabilities=analysis.ai_prediction.class_probabilities_json,
        )

    latest_decision = analysis.decisions[-1] if analysis.decisions else None
    decision = None
    if latest_decision is not None:
        decision = DecisionRead(
            decision=latest_decision.decision,
            confidence=float(latest_decision.confidence),
            rationale=latest_decision.rationale,
            rules_version=latest_decision.rules_version,
            fused_damage=float(latest_decision.fused_damage),
            ndvi_damage=float(latest_decision.ndvi_damage),
            ndwi_damage=float(latest_decision.ndwi_damage),
            evi_damage=float(latest_decision.evi_damage),
            ai_damage=float(latest_decision.ai_damage),
            area_score=float(latest_decision.area_score),
        )
    farmer_assessment = None
    if decision is not None:
        damage_score = decision.fused_damage
        risk_level = _risk_label(damage_score)
        summary = (
            f"Estimated crop damage is {damage_score:.1f}% based on fused NDVI, NDWI, EVI, AI, and area signals. "
            f"Risk level: {risk_level}."
        )
        farmer_assessment = DamageAssessmentRead(
            possible_damage_percentage=damage_score,
            risk_level=risk_level,
            summary=summary,
        )
    elif metrics is not None:
        risk_level = _risk_label(metrics.damage_percentage)
        summary = (
            f"Estimated crop damage is {metrics.damage_percentage:.1f}% based on NDVI change. "
            f"Risk level: {risk_level}."
        )
        farmer_assessment = DamageAssessmentRead(
            possible_damage_percentage=metrics.damage_percentage,
            risk_level=risk_level,
            summary=summary,
        )

    return AnalysisRunRead(
        id=analysis.id,
        claim_id=analysis.claim_id,
        status=analysis.status,
        status_message=analysis.status_message,
        gap_before=analysis.gap_before,
        gap_after=analysis.gap_after,
        window_days=analysis.window_days,
        max_cloud_threshold=analysis.max_cloud_threshold,
        before_scene_date=analysis.before_scene_date,
        after_scene_date=analysis.after_scene_date,
        before_scene_source=analysis.before_scene_source,
        after_scene_source=analysis.after_scene_source,
        started_at=analysis.started_at,
        completed_at=analysis.completed_at,
        created_at=analysis.created_at,
        metrics=metrics,
        ai_prediction=ai_prediction,
        decision=decision,
        farmer_assessment=farmer_assessment,
    )


def _to_clean_data_url(image: np.ndarray) -> str:
    png = array_to_clean_png_bytes(image)
    encoded = base64.b64encode(png).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _to_data_url(
    image,
    *,
    title: str,
    cmap: str | None = None,
    figsize: tuple[float, float] = (4.5, 4.5),
    dpi: int = 180,
    interpolation: str = "bicubic",
) -> str:
    png = array_to_png_bytes(
        image,
        title=title,
        cmap=cmap,
        figsize=figsize,
        dpi=dpi,
        interpolation=interpolation,
    )
    encoded = base64.b64encode(png).decode("ascii")
    return f"data:image/png;base64,{encoded}"


@router.post("", response_model=ClaimRead, status_code=status.HTTP_201_CREATED)
async def create_claim(
    payload: ClaimCreateRequest,
    session: AsyncSession = Depends(db_session_dep),
    redis_client: Redis = Depends(redis_dep),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ClaimRead:
    service = ClaimService(session)
    dashboard = DashboardService(session, redis_client=redis_client)
    owner_farmer_user_id = current_user.farmer_id if current_user.role == "farmer" else None
    claim = await service.create_claim(payload, farmer_user_id=owner_farmer_user_id)
    await dashboard.invalidate_summary_cache()
    return _to_claim_schema(claim)


@router.get("", response_model=ClaimListResponse)
async def list_claims(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(db_session_dep),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ClaimListResponse:
    service = ClaimService(session)
    owner_farmer_user_id = current_user.farmer_id if current_user.role == "farmer" else None
    claims = await service.list_claims(limit=limit, offset=offset, farmer_user_id=owner_farmer_user_id)
    return ClaimListResponse(items=[_to_claim_schema(item) for item in claims], limit=limit, offset=offset)


@router.get("/{claim_id}", response_model=ClaimRead)
async def get_claim(
    claim_id: int,
    session: AsyncSession = Depends(db_session_dep),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ClaimRead:
    service = ClaimService(session)
    claim = await service.get_claim_or_404(claim_id)
    _assert_claim_access_or_403(claim, current_user)
    return _to_claim_schema(claim)


@router.post("/{claim_id}/analyze", response_model=JobAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
async def analyze_claim(
    claim_id: int,
    payload: AnalyzeClaimRequest,
    session: AsyncSession = Depends(db_session_dep),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> JobAcceptedResponse:
    claim_service = ClaimService(session)
    claim = await claim_service.get_claim_or_404(claim_id)
    _assert_claim_access_or_403(claim, current_user)
    jobs = JobService(session)
    job = await jobs.enqueue_analysis(claim_id=claim_id, request=payload)
    return JobAcceptedResponse(job_id=job.id, status=job.status)


@router.patch("/{claim_id}/farmer-notes", response_model=ClaimRead)
async def submit_farmer_notes(
    claim_id: int,
    payload: FarmerNotesRequest,
    session: AsyncSession = Depends(db_session_dep),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ClaimRead:
    service = ClaimService(session)
    claim = await service.submit_farmer_notes(claim_id=claim_id, notes=payload.notes, current_user=current_user)
    return _to_claim_schema(claim)


@router.get("/{claim_id}/analysis", response_model=ClaimAnalysisResponse)
async def get_claim_analysis(
    claim_id: int,
    session: AsyncSession = Depends(db_session_dep),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ClaimAnalysisResponse:
    claim_service = ClaimService(session)
    claim = await claim_service.get_claim_or_404(claim_id)
    _assert_claim_access_or_403(claim, current_user)
    latest_analysis = claim.analysis_runs[0] if claim.analysis_runs else None
    return ClaimAnalysisResponse(claim_id=claim_id, analysis=_to_analysis_schema(latest_analysis))


@router.get("/{claim_id}/analysis/artifacts", response_model=AnalysisArtifactsResponse)
async def get_claim_analysis_artifacts(
    claim_id: int,
    session: AsyncSession = Depends(db_session_dep),
    redis_client: Redis = Depends(redis_dep),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AnalysisArtifactsResponse:
    claim_service = ClaimService(session)
    claim = await claim_service.get_claim_or_404(claim_id)
    _assert_claim_access_or_403(claim, current_user)
    latest_analysis = claim.analysis_runs[0] if claim.analysis_runs else None
    if latest_analysis is None:
        raise NotFoundError(f"No analysis run found for claim '{claim_id}'.")

    pipeline = AnalysisPipelineService(session, redis_client=redis_client)
    artifacts = await pipeline.load_analysis_artifacts(latest_analysis.id)
    if artifacts is None:
        settings = get_settings()
        satellite = SatelliteService(redis_client=redis_client)
        before_scene, after_scene, _ = await satellite.fetch_satellite_pair(
            latitude=float(claim.latitude),
            longitude=float(claim.longitude),
            damage_date=claim.damage_date.isoformat(),
            area_hectares=float(claim.farm_area_hectares),
            gap_before=latest_analysis.gap_before or settings.default_gap_before_days,
            gap_after=latest_analysis.gap_after or settings.default_gap_after_days,
            window_days=latest_analysis.window_days or settings.default_window_days,
            max_cloud_threshold=latest_analysis.max_cloud_threshold or settings.default_max_cloud_threshold,
            upscale_factor=4,
        )
        _, maps = compute_metrics(before_scene.bands, after_scene.bands)
        artifacts = {
            "before_rgb": before_scene.rgb_image,
            "after_rgb": after_scene.rgb_image,
            **maps,
        }

    return AnalysisArtifactsResponse(
        claim_id=claim_id,
        analysis_run_id=latest_analysis.id,
        before_rgb_data_url=_to_clean_data_url(artifacts["before_rgb"]),
        after_rgb_data_url=_to_clean_data_url(artifacts["after_rgb"]),
        ndvi_before_data_url=_to_data_url(
            artifacts["ndvi_before"],
            title="NDVI Before",
            cmap="RdYlGn",
            figsize=(6.0, 4.5),
            dpi=220,
            interpolation="bilinear",
        ),
        ndvi_after_data_url=_to_data_url(
            artifacts["ndvi_after"],
            title="NDVI After",
            cmap="RdYlGn",
            figsize=(6.0, 4.5),
            dpi=220,
            interpolation="bilinear",
        ),
        ndwi_before_data_url=_to_data_url(
            artifacts["ndwi_before"],
            title="NDWI Before",
            cmap="RdYlBu",
            figsize=(6.0, 4.5),
            dpi=220,
            interpolation="bilinear",
        ),
        ndwi_after_data_url=_to_data_url(
            artifacts["ndwi_after"],
            title="NDWI After",
            cmap="RdYlBu",
            figsize=(6.0, 4.5),
            dpi=220,
            interpolation="bilinear",
        ),
        evi_before_data_url=_to_data_url(
            artifacts["evi_before"],
            title="EVI Before",
            cmap="YlGn",
            figsize=(6.0, 4.5),
            dpi=220,
            interpolation="bilinear",
        ),
        evi_after_data_url=_to_data_url(
            artifacts["evi_after"],
            title="EVI After",
            cmap="YlGn",
            figsize=(6.0, 4.5),
            dpi=220,
            interpolation="bilinear",
        ),
    )


@router.post("/{claim_id}/report", response_model=JobAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_report(
    claim_id: int,
    payload: ReportCreateRequest,
    session: AsyncSession = Depends(db_session_dep),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> JobAcceptedResponse:
    claim_service = ClaimService(session)
    claim = await claim_service.get_claim_or_404(claim_id)
    _assert_claim_access_or_403(claim, current_user)
    jobs = JobService(session)
    job = await jobs.enqueue_report(claim_id=claim_id, request=payload)
    return JobAcceptedResponse(job_id=job.id, status=job.status)


@router.get("/{claim_id}/report", response_model=ReportMetadataResponse)
async def get_report(
    claim_id: int,
    download: bool = Query(default=False, description="Set true to download PDF directly."),
    session: AsyncSession = Depends(db_session_dep),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ReportMetadataResponse | FileResponse:
    claim_service = ClaimService(session)
    claim = await claim_service.get_claim_or_404(claim_id)
    _assert_claim_access_or_403(claim, current_user)
    report_service = ReportService(session)
    if download:
        pdf_bytes = await report_service.render_report_pdf(claim_id=claim_id)
        filename = f"cropshield-claim-{claim_id}-report.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    report = await report_service.get_latest_report_or_404(claim_id)

    return ReportMetadataResponse(
        id=report.id,
        claim_id=report.claim_id,
        analysis_run_id=report.analysis_run_id,
        file_path_or_object_key=report.file_path_or_object_key,
        mime_type=report.mime_type,
        generated_at=report.generated_at,
    )


@router.post("/{claim_id}/report/download", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
async def redirect_report_download(
    claim_id: int,
    session: AsyncSession = Depends(db_session_dep),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Response:
    claim_service = ClaimService(session)
    claim = await claim_service.get_claim_or_404(claim_id)
    _assert_claim_access_or_403(claim, current_user)
    return Response(status_code=status.HTTP_307_TEMPORARY_REDIRECT, headers={"Location": f"/api/v1/claims/{claim_id}/report?download=true"})
