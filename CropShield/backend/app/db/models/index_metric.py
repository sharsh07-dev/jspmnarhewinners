from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.analysis_run import AnalysisRun


class IndexMetric(Base):
    __tablename__ = "index_metrics"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    analysis_run_id: Mapped[int] = mapped_column(
        ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    ndvi_before: Mapped[float] = mapped_column(Numeric(8, 5), nullable=False)
    ndvi_after: Mapped[float] = mapped_column(Numeric(8, 5), nullable=False)
    ndwi_before: Mapped[float] = mapped_column(Numeric(8, 5), nullable=False, default=0.0)
    ndwi_after: Mapped[float] = mapped_column(Numeric(8, 5), nullable=False, default=0.0)
    evi_before: Mapped[float] = mapped_column(Numeric(8, 5), nullable=False, default=0.0)
    evi_after: Mapped[float] = mapped_column(Numeric(8, 5), nullable=False, default=0.0)
    damage_percentage: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False)

    analysis_run: Mapped["AnalysisRun"] = relationship(back_populates="metrics")
