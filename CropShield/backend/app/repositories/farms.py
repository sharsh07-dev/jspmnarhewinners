from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import FarmProfile


class FarmRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        farmer_name: str,
        owner_names_json: list[str],
        survey_numbers_json: list[str],
        area_values_json: list[str],
        automation_raw_text: str | None,
        state_index: int,
        category_index: int,
        district_index: int,
        taluka_index: int,
        village_index: int,
        plot_index: int,
        state_name: str | None,
        category_name: str | None,
        district_name: str | None,
        taluka_name: str | None,
        village_name: str | None,
        plot_name: str | None,
        extent_min_x: float,
        extent_min_y: float,
        extent_max_x: float,
        extent_max_y: float,
        extent_polygon_json: list[list[float]] | None,
        centroid_latitude: float,
        centroid_longitude: float,
        farm_area_hectares: float,
        screenshot_path: str | None,
        automation_source: str,
        automation_status_message: str | None,
        metadata_json: dict[str, Any] | None,
    ) -> FarmProfile:
        row = FarmProfile(
            farmer_name=farmer_name,
            owner_names_json=owner_names_json,
            survey_numbers_json=survey_numbers_json,
            area_values_json=area_values_json,
            automation_raw_text=automation_raw_text,
            state_index=state_index,
            category_index=category_index,
            district_index=district_index,
            taluka_index=taluka_index,
            village_index=village_index,
            plot_index=plot_index,
            state_name=state_name,
            category_name=category_name,
            district_name=district_name,
            taluka_name=taluka_name,
            village_name=village_name,
            plot_name=plot_name,
            extent_min_x=extent_min_x,
            extent_min_y=extent_min_y,
            extent_max_x=extent_max_x,
            extent_max_y=extent_max_y,
            extent_polygon_json=extent_polygon_json,
            centroid_latitude=centroid_latitude,
            centroid_longitude=centroid_longitude,
            farm_area_hectares=farm_area_hectares,
            screenshot_path=screenshot_path,
            automation_source=automation_source,
            automation_status_message=automation_status_message,
            metadata_json=metadata_json,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def get_by_id(self, farm_profile_id: int) -> FarmProfile | None:
        stmt = select(FarmProfile).where(FarmProfile.id == farm_profile_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_profiles(self, *, limit: int, offset: int) -> list[FarmProfile]:
        stmt = (
            select(FarmProfile)
            .order_by(FarmProfile.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
