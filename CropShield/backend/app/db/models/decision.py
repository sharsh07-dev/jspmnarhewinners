from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.analysis_run import AnalysisRun
    from app.db.models.claim import Claim


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    decision: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Numeric(8, 5), nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    rules_version: Mapped[str] = mapped_column(String(80), nullable=False, default="v1-streamlit-compatible")
    fused_damage: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False, default=0.0)
    ndvi_damage: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False, default=0.0)
    ndwi_damage: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False, default=0.0)
    evi_damage: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False, default=0.0)
    ai_damage: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False, default=0.0)
    area_score: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    claim: Mapped["Claim"] = relationship(back_populates="decisions")
    analysis_run: Mapped["AnalysisRun"] = relationship(back_populates="decisions")
