from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class JobStatusResponse(BaseModel):
    id: str
    job_type: str
    resource_type: str
    resource_id: int
    status: str
    progress: int
    payload_json: dict[str, Any] | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime
