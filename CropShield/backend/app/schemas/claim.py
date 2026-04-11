from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ClaimCreateRequest(BaseModel):
    farm_profile_id: int | None = Field(default=None, gt=0)
    farmer_name: str | None = Field(default=None, min_length=1, max_length=255)
    crop_type: str = Field(min_length=1, max_length=80)
    farm_area_hectares: float | None = Field(default=None, gt=0)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    damage_date: date

    @field_validator("farmer_name", "crop_type")
    @classmethod
    def _strip_values(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned

    @model_validator(mode="after")
    def _validate_location_requirements(self) -> "ClaimCreateRequest":
        if self.farm_profile_id is not None:
            return self
        missing = []
        if self.farmer_name is None:
            missing.append("farmer_name")
        if self.farm_area_hectares is None:
            missing.append("farm_area_hectares")
        if self.latitude is None:
            missing.append("latitude")
        if self.longitude is None:
            missing.append("longitude")
        if missing:
            joined = ", ".join(missing)
            raise ValueError(
                f"{joined} required when farm_profile_id is not provided"
            )
        return self

    @field_validator("damage_date")
    @classmethod
    def _validate_damage_date(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("damage_date cannot be in the future")
        return value


class ClaimRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farm_profile_id: int | None = None
    farmer_name: str
    crop_type: str
    farm_area_hectares: float
    latitude: float
    longitude: float
    damage_date: date
    status: str
    admin_status: str
    admin_notes: str | None = None
    farmer_notes: str | None = None
    reviewed_by: str | None = None
    recommended_insurance_amount: float | None = None
    pmfby_reference_url: str
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ClaimListResponse(BaseModel):
    items: list[ClaimRead]
    limit: int
    offset: int


class AnalyzeClaimRequest(BaseModel):
    gap_before: int = Field(default=5, ge=1, le=30)
    gap_after: int = Field(default=5, ge=1, le=30)
    window_days: int = Field(default=10, ge=7, le=45)
    max_cloud_threshold: int = Field(default=100, ge=20, le=100)
    upscale_factor: int = Field(default=3, ge=2, le=4)


class JobAcceptedResponse(BaseModel):
    job_id: str
    status: str


class FarmerNotesRequest(BaseModel):
    notes: str = Field(min_length=1, max_length=2000)

    @field_validator("notes")
    @classmethod
    def _strip_notes(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("notes must not be empty")
        return cleaned
