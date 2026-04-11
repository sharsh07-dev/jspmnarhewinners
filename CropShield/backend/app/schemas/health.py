from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime


class ReadinessResponse(BaseModel):
    status: str
    database: str
    redis: str
