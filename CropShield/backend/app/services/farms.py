from __future__ import annotations

import base64
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.repositories.farms import FarmRepository
from app.schemas.farm import FarmLookupRequest
from app.services.mahabhunakasha import MahabhunakashaService
from app.utils.domain_helpers import extent_to_polygon_lat_lon, parse_area_hectares, polygon_centroid


class FarmService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = FarmRepository(session)
        self.automation = MahabhunakashaService()

    async def onboard_farm(self, payload: FarmLookupRequest):
        automation = self.automation.lookup_plot(
            state_index=payload.state_index,
            category_index=payload.category_index,
            district_index=payload.district_index,
            taluka_index=payload.taluka_index,
            village_index=payload.village_index,
            plot_index=payload.plot_index,
            headless=payload.headless,
        )

        extent = automation.extent
        if len(extent) != 4:
            extent = [73.855700, 18.520100, 73.857000, 18.521000]

        polygon = extent_to_polygon_lat_lon(extent)
        if not polygon and automation.polygon:
            polygon = automation.polygon
        lat, lon = polygon_centroid(polygon)
        area_ha = parse_area_hectares(automation.areas, default=2.5)

        selection = automation.selection
        row = await self.repo.create(
            farmer_name=payload.farmer_name,
            owner_names_json=automation.owners,
            survey_numbers_json=automation.surveys,
            area_values_json=automation.areas,
            automation_raw_text=automation.raw_plot_text,
            state_index=int(selection.get("state_index", payload.state_index)),
            category_index=int(selection.get("category_index", payload.category_index)),
            district_index=int(selection.get("district_index", payload.district_index)),
            taluka_index=int(selection.get("taluka_index", payload.taluka_index)),
            village_index=int(selection.get("village_index", payload.village_index)),
            plot_index=int(selection.get("plot_index", payload.plot_index)),
            state_name=selection.get("state_name"),
            category_name=selection.get("category_name"),
            district_name=selection.get("district_name"),
            taluka_name=selection.get("taluka_name"),
            village_name=selection.get("village_name"),
            plot_name=selection.get("plot_name"),
            extent_min_x=float(extent[0]),
            extent_min_y=float(extent[1]),
            extent_max_x=float(extent[2]),
            extent_max_y=float(extent[3]),
            extent_polygon_json=polygon,
            centroid_latitude=lat,
            centroid_longitude=lon,
            farm_area_hectares=area_ha,
            screenshot_path=automation.screenshot_path,
            automation_source=automation.source,
            automation_status_message=automation.status_message,
            metadata_json=automation.raw_payload,
        )
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def get_farm_or_404(self, farm_profile_id: int):
        farm = await self.repo.get_by_id(farm_profile_id)
        if farm is None:
            raise NotFoundError(f"Farm profile '{farm_profile_id}' was not found.")
        return farm

    async def list_farms(self, *, limit: int, offset: int):
        return await self.repo.list_profiles(limit=limit, offset=offset)

    def list_land_record_options(
        self,
        *,
        state_index: int | None = None,
        category_index: int | None = None,
        district_index: int | None = None,
        taluka_index: int | None = None,
        village_index: int | None = None,
        headless: bool = True,
    ) -> dict:
        return self.automation.fetch_location_options(
            state_index=state_index,
            category_index=category_index,
            district_index=district_index,
            taluka_index=taluka_index,
            village_index=village_index,
            headless=headless,
        )

    @staticmethod
    def screenshot_to_data_url(path: str | None) -> str | None:
        if not path:
            return None
        file_path = Path(path)
        if not file_path.exists() or not file_path.is_file():
            return None
        try:
            mime = "image/png"
            if file_path.suffix.lower() in {".jpg", ".jpeg"}:
                mime = "image/jpeg"
            elif file_path.suffix.lower() == ".webp":
                mime = "image/webp"
            payload = base64.b64encode(file_path.read_bytes()).decode("ascii")
            return f"data:{mime};base64,{payload}"
        except Exception:
            return None
