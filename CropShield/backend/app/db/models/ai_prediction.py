from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.analysis_run import AnalysisRun


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    analysis_run_id: Mapped[int] = mapped_column(
        ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    model_version: Mapped[str] = mapped_column(String(80), nullable=False, default="heuristic-v1")
    predicted_class: Mapped[str] = mapped_column(String(80), nullable=False)
    damage_probability: Mapped[float] = mapped_column(Numeric(8, 5), nullable=False)
    damaged_area_percentage: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False)
    class_probabilities_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    analysis_run: Mapped["AnalysisRun"] = relationship(back_populates="ai_prediction")
