from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ReportCreateRequest(BaseModel):
    analysis_run_id: int | None = None


class ReportMetadataResponse(BaseModel):
    id: int
    claim_id: int
    analysis_run_id: int
    file_path_or_object_key: str
    mime_type: str
    generated_at: datetime
