from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.claim import Claim


class FarmProfile(Base):
    __tablename__ = "farm_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farmer_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    owner_names_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    survey_numbers_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    area_values_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    automation_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    state_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    category_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    district_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    taluka_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    village_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    plot_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    state_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    category_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    district_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    taluka_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    village_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    plot_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    extent_min_x: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False)
    extent_min_y: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False)
    extent_max_x: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False)
    extent_max_y: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False)
    extent_polygon_json: Mapped[list[list[float]] | None] = mapped_column(JSON, nullable=True)

    centroid_latitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    centroid_longitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    farm_area_hectares: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)

    screenshot_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    automation_source: Mapped[str] = mapped_column(String(120), nullable=False, default="mahabhunakasha")
    automation_status_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    claims: Mapped[list["Claim"]] = relationship(back_populates="farm_profile")
