from __future__ import annotations

from pydantic import BaseModel, Field


class DiseaseDetectRequest(BaseModel):
    image_name: str = Field(min_length=1, max_length=255)
    crop_type: str | None = Field(default=None, max_length=100)


class DiseaseDetectResponse(BaseModel):
    predicted_disease: str
    confidence: float
    recommendation: str
