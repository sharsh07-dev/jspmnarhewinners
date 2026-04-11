from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.analysis import AnalysisRunRead


AdminClaimStatus = Literal["pending_review", "approved", "rejected", "needs_more_info"]


class AdminClaimItem(BaseModel):
    claim_id: int
    farm_profile_id: int | None = None
    farmer_name: str
    crop_type: str
    damage_date: date
    status: str
    admin_status: str
    recommended_insurance_amount: float | None = None
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    pmfby_reference_url: str
    extent: list[float] | None = None
    polygon: list[list[float]] | None = None
    owner_names: list[str] = Field(default_factory=list)
    area_values: list[str] = Field(default_factory=list)
    screenshot_data_url: str | None = None
    latest_damage_percentage: float | None = None
    latest_ai_damage_probability: float | None = None
    latest_risk_label: str | None = None


class AdminClaimListResponse(BaseModel):
    items: list[AdminClaimItem]
    limit: int
    offset: int
    total_count: int


class ClaimAuditLogRead(BaseModel):
    id: int
    claim_id: int
    actor: str
    action: str
    old_status: str | None = None
    new_status: str | None = None
    notes: str | None = None
    created_at: datetime


class AdminClaimFullResponse(BaseModel):
    claim: AdminClaimItem
    admin_notes: str | None = None
    farmer_notes: str | None = None
    latest_analysis: AnalysisRunRead | None = None
    audit_logs: list[ClaimAuditLogRead] = Field(default_factory=list)


class AdminClaimReviewRequest(BaseModel):
    admin_status: AdminClaimStatus
    reviewed_by: str = Field(min_length=1, max_length=120)
    admin_notes: str | None = Field(default=None, max_length=5000)
    recommended_insurance_amount: float | None = Field(default=None, ge=0)

    @field_validator("reviewed_by")
    @classmethod
    def _strip_reviewer(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("reviewed_by must not be empty")
        return cleaned


class AdminClaimReviewResponse(BaseModel):
    claim_id: int
    admin_status: str
    reviewed_by: str
    admin_notes: str | None = None
    recommended_insurance_amount: float | None = None
    pmfby_reference_url: str
    reviewed_at: datetime


class AdminBulkReviewRequest(BaseModel):
    claim_ids: list[int] = Field(min_length=1)
    admin_status: AdminClaimStatus
    reviewed_by: str = Field(min_length=1, max_length=120)
    admin_notes: str | None = Field(default=None, max_length=5000)
    recommended_insurance_amount: float | None = Field(default=None, ge=0)

    @field_validator("reviewed_by")
    @classmethod
    def _strip_bulk_reviewer(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("reviewed_by must not be empty")
        return cleaned


class AdminBulkReviewResponse(BaseModel):
    updated_claim_ids: list[int]
