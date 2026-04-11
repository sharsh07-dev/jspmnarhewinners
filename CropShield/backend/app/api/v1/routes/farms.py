from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep
from app.schemas.farm import FarmLookupRequest, FarmOptionsResponse, FarmProfileListResponse, FarmProfileRead
from app.services.farms import FarmService
from app.utils.domain_helpers import extent_to_polygon_lat_lon

router = APIRouter(prefix="/farms", tags=["farms"])


def _to_farm_schema(farm, *, include_screenshot_data: bool = True) -> FarmProfileRead:
    extent = [
        float(farm.extent_min_x),
        float(farm.extent_min_y),
        float(farm.extent_max_x),
        float(farm.extent_max_y),
    ]
    polygon = farm.extent_polygon_json or extent_to_polygon_lat_lon(extent)
    return FarmProfileRead(
        id=farm.id,
        farmer_name=farm.farmer_name,
        owner_names=farm.owner_names_json or [],
        survey_numbers=farm.survey_numbers_json or [],
        area_values=farm.area_values_json or [],
        farm_area_hectares=float(farm.farm_area_hectares),
        extent=extent,
        polygon=polygon,
        centroid_latitude=float(farm.centroid_latitude),
        centroid_longitude=float(farm.centroid_longitude),
        state_index=farm.state_index,
        category_index=farm.category_index,
        district_index=farm.district_index,
        taluka_index=farm.taluka_index,
        village_index=farm.village_index,
        plot_index=farm.plot_index,
        state_name=farm.state_name,
        category_name=farm.category_name,
        district_name=farm.district_name,
        taluka_name=farm.taluka_name,
        village_name=farm.village_name,
        plot_name=farm.plot_name,
        screenshot_data_url=FarmService.screenshot_to_data_url(farm.screenshot_path) if include_screenshot_data else None,
        screenshot_path=farm.screenshot_path,
        automation_source=farm.automation_source,
        automation_status_message=farm.automation_status_message,
        created_at=farm.created_at,
        updated_at=farm.updated_at,
    )


@router.post("/lookup", response_model=FarmProfileRead, status_code=status.HTTP_201_CREATED)
async def lookup_and_create_farm(
    payload: FarmLookupRequest,
    session: AsyncSession = Depends(db_session_dep),
) -> FarmProfileRead:
    service = FarmService(session)
    farm = await service.onboard_farm(payload)
    return _to_farm_schema(farm)


@router.get("/options", response_model=FarmOptionsResponse)
async def farm_options(
    state_index: int | None = Query(default=None, ge=0),
    category_index: int | None = Query(default=None, ge=0),
    district_index: int | None = Query(default=None, ge=0),
    taluka_index: int | None = Query(default=None, ge=0),
    village_index: int | None = Query(default=None, ge=0),
    headless: bool = Query(default=True),
    session: AsyncSession = Depends(db_session_dep),
) -> FarmOptionsResponse:
    service = FarmService(session)
    payload = service.list_land_record_options(
        state_index=state_index,
        category_index=category_index,
        district_index=district_index,
        taluka_index=taluka_index,
        village_index=village_index,
        headless=headless,
    )
    return FarmOptionsResponse.model_validate(payload)


@router.get("", response_model=FarmProfileListResponse)
async def list_farms(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(db_session_dep),
) -> FarmProfileListResponse:
    service = FarmService(session)
    farms = await service.list_farms(limit=limit, offset=offset)
    return FarmProfileListResponse(
        items=[_to_farm_schema(item, include_screenshot_data=False) for item in farms],
        limit=limit,
        offset=offset,
    )


@router.get("/{farm_profile_id}", response_model=FarmProfileRead)
async def get_farm(
    farm_profile_id: int,
    session: AsyncSession = Depends(db_session_dep),
) -> FarmProfileRead:
    service = FarmService(session)
    farm = await service.get_farm_or_404(farm_profile_id)
    return _to_farm_schema(farm)
