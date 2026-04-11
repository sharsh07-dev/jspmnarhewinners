from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep
from app.core.security import require_admin
from app.schemas.admin import (
    AdminBulkReviewRequest,
    AdminBulkReviewResponse,
    AdminClaimFullResponse,
    AdminClaimItem,
    AdminClaimListResponse,
    AdminClaimReviewRequest,
    AdminClaimReviewResponse,
    ClaimAuditLogRead,
)
from app.schemas.auth import AuthenticatedUser
from app.schemas.report import ReportMetadataResponse
from app.services.admin import AdminService, classify_risk
from app.services.farms import FarmService
from app.services.reports import ReportService
from app.api.v1.routes.claims import _to_analysis_schema
from app.utils.domain_helpers import extent_to_polygon_lat_lon

router = APIRouter(prefix="/admin", tags=["admin"])


def _to_admin_item(claim) -> AdminClaimItem:
    farm = claim.farm_profile
    extent = None
    polygon = None
    owner_names: list[str] = []
    area_values: list[str] = []
    screenshot_data_url = None
    if farm is not None:
        extent = [
            float(farm.extent_min_x),
            float(farm.extent_min_y),
            float(farm.extent_max_x),
            float(farm.extent_max_y),
        ]
        polygon = farm.extent_polygon_json or extent_to_polygon_lat_lon(extent)
        owner_names = farm.owner_names_json or []
        area_values = farm.area_values_json or []
        screenshot_data_url = FarmService.screenshot_to_data_url(farm.screenshot_path)

    latest_analysis = claim.analysis_runs[0] if claim.analysis_runs else None
    latest_damage = None
    latest_ai_prob = None
    risk_label = None
    if latest_analysis and latest_analysis.metrics:
        latest_damage = float(latest_analysis.metrics.damage_percentage)
        risk_label = classify_risk(latest_damage)
    if latest_analysis and latest_analysis.ai_prediction:
        latest_ai_prob = float(latest_analysis.ai_prediction.damage_probability)

    return AdminClaimItem(
        claim_id=claim.id,
        farm_profile_id=claim.farm_profile_id,
        farmer_name=claim.farmer_name,
        crop_type=claim.crop_type,
        damage_date=claim.damage_date,
        status=claim.status,
        admin_status=claim.admin_status,
        recommended_insurance_amount=float(claim.recommended_insurance_amount) if claim.recommended_insurance_amount else None,
        reviewed_by=claim.reviewed_by,
        reviewed_at=claim.reviewed_at,
        pmfby_reference_url=claim.pmfby_reference_url,
        extent=extent,
        polygon=polygon,
        owner_names=owner_names,
        area_values=area_values,
        screenshot_data_url=screenshot_data_url,
        latest_damage_percentage=latest_damage,
        latest_ai_damage_probability=latest_ai_prob,
        latest_risk_label=risk_label,
    )


@router.get("/claims", response_model=AdminClaimListResponse)
async def list_admin_claims(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    status: str | None = Query(default=None),
    admin_status: str | None = Query(default=None),
    crop_type: str | None = Query(default=None),
    damage_date_from: date | None = Query(default=None),
    damage_date_to: date | None = Query(default=None),
    search: str | None = Query(default=None),
    session: AsyncSession = Depends(db_session_dep),
    _: AuthenticatedUser = Depends(require_admin),
) -> AdminClaimListResponse:
    service = AdminService(session)
    claims, total_count = await service.list_claims(
        limit=limit,
        offset=offset,
        status=status,
        admin_status=admin_status,
        crop_type=crop_type,
        damage_date_from=damage_date_from,
        damage_date_to=damage_date_to,
        search=search,
    )
    return AdminClaimListResponse(
        items=[_to_admin_item(item) for item in claims],
        limit=limit,
        offset=offset,
        total_count=total_count,
    )


@router.get("/claims/{claim_id}/full", response_model=AdminClaimFullResponse)
async def get_admin_claim_full(
    claim_id: int,
    session: AsyncSession = Depends(db_session_dep),
    _: AuthenticatedUser = Depends(require_admin),
) -> AdminClaimFullResponse:
    service = AdminService(session)
    claim = await service.get_claim_full_or_404(claim_id)
    latest_analysis = claim.analysis_runs[0] if claim.analysis_runs else None
    return AdminClaimFullResponse(
        claim=_to_admin_item(claim),
        admin_notes=claim.admin_notes,
        farmer_notes=claim.farmer_notes,
        latest_analysis=_to_analysis_schema(latest_analysis),
        audit_logs=[
            ClaimAuditLogRead(
                id=log.id,
                claim_id=log.claim_id,
                actor=log.actor,
                action=log.action,
                old_status=log.old_status,
                new_status=log.new_status,
                notes=log.notes,
                created_at=log.created_at,
            )
            for log in claim.audit_logs
        ],
    )


@router.patch("/claims/{claim_id}/review", response_model=AdminClaimReviewResponse)
async def review_claim(
    claim_id: int,
    payload: AdminClaimReviewRequest,
    session: AsyncSession = Depends(db_session_dep),
    _: AuthenticatedUser = Depends(require_admin),
) -> AdminClaimReviewResponse:
    service = AdminService(session)
    claim = await service.review_claim(claim_id=claim_id, payload=payload)
    return AdminClaimReviewResponse(
        claim_id=claim.id,
        admin_status=claim.admin_status,
        reviewed_by=claim.reviewed_by or payload.reviewed_by,
        admin_notes=claim.admin_notes,
        recommended_insurance_amount=float(claim.recommended_insurance_amount) if claim.recommended_insurance_amount else None,
        pmfby_reference_url=claim.pmfby_reference_url,
        reviewed_at=claim.reviewed_at,
    )


@router.patch("/claims/bulk-review", response_model=AdminBulkReviewResponse)
async def bulk_review_claims(
    payload: AdminBulkReviewRequest,
    session: AsyncSession = Depends(db_session_dep),
    _: AuthenticatedUser = Depends(require_admin),
) -> AdminBulkReviewResponse:
    service = AdminService(session)
    updated_claim_ids = await service.bulk_review_claims(payload)
    return AdminBulkReviewResponse(updated_claim_ids=updated_claim_ids)


@router.get("/claims/{claim_id}/report", response_model=ReportMetadataResponse)
async def get_admin_report(
    claim_id: int,
    download: bool = Query(default=False),
    session: AsyncSession = Depends(db_session_dep),
    _: AuthenticatedUser = Depends(require_admin),
) -> ReportMetadataResponse | Response:
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
