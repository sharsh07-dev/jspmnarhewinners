from __future__ import annotations

from pydantic import BaseModel, Field


class AdvisoryChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    language: str = Field(default="en", min_length=2, max_length=10)


class AdvisoryChatResponse(BaseModel):
    provider: str
    reply: str
    fallback_used: bool = False


class CropPredictRequest(BaseModel):
    crop_type: str = Field(min_length=2, max_length=80)
    soil_type: str = Field(min_length=2, max_length=80)
    rainfall_mm: float = Field(ge=0, le=5000)
    temperature_c: float = Field(ge=-20, le=60)


class CropPredictResponse(BaseModel):
    expected_yield_tph: float
    risk_level: str
    recommendation: str
