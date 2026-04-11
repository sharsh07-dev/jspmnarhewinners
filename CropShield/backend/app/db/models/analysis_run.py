from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.ai_prediction import AIPrediction
    from app.db.models.claim import Claim
    from app.db.models.decision import Decision
    from app.db.models.index_metric import IndexMetric
    from app.db.models.report import Report


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="queued", index=True)
    status_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    gap_before: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    gap_after: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    window_days: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    max_cloud_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    before_scene_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    after_scene_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    before_scene_source: Mapped[str | None] = mapped_column(String(120), nullable=True)
    after_scene_source: Mapped[str | None] = mapped_column(String(120), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    claim: Mapped["Claim"] = relationship(back_populates="analysis_runs")
    metrics: Mapped["IndexMetric | None"] = relationship(
        back_populates="analysis_run", uselist=False, cascade="all, delete-orphan"
    )
    ai_prediction: Mapped["AIPrediction | None"] = relationship(
        back_populates="analysis_run", uselist=False, cascade="all, delete-orphan"
    )
    decisions: Mapped[list["Decision"]] = relationship(back_populates="analysis_run", cascade="all, delete-orphan")
    reports: Mapped[list["Report"]] = relationship(back_populates="analysis_run", cascade="all, delete-orphan")
