from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.analysis_run import AnalysisRun
    from app.db.models.claim_audit_log import ClaimAuditLog
    from app.db.models.decision import Decision
    from app.db.models.farmer_user import FarmerUser
    from app.db.models.farm_profile import FarmProfile
    from app.db.models.report import Report


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farmer_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("farmer_users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    farm_profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("farm_profiles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    farmer_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    crop_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    farm_area_hectares: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    latitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    damage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="created", index=True)
    admin_status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending_review", index=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    farmer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    recommended_insurance_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    pmfby_reference_url: Mapped[str] = mapped_column(String(255), nullable=False, default="https://pmfby.gov.in/")
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    farm_profile: Mapped["FarmProfile | None"] = relationship(back_populates="claims")
    analysis_runs: Mapped[list["AnalysisRun"]] = relationship(
        back_populates="claim",
        cascade="all, delete-orphan",
        order_by="AnalysisRun.created_at.desc()",
    )
    decisions: Mapped[list["Decision"]] = relationship(back_populates="claim", cascade="all, delete-orphan")
    reports: Mapped[list["Report"]] = relationship(back_populates="claim", cascade="all, delete-orphan")
    audit_logs: Mapped[list["ClaimAuditLog"]] = relationship(
        back_populates="claim",
        cascade="all, delete-orphan",
        order_by="ClaimAuditLog.created_at.desc()",
    )
