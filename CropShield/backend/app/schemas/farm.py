from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FarmLookupRequest(BaseModel):
    farmer_name: str = Field(min_length=1, max_length=255)
    state_index: int = Field(default=0, ge=0)
    category_index: int = Field(default=0, ge=0)
    district_index: int = Field(default=0, ge=0)
    taluka_index: int = Field(default=0, ge=0)
    village_index: int = Field(default=0, ge=0)
    plot_index: int = Field(default=0, ge=0)
    headless: bool = True

    @field_validator("farmer_name")
    @classmethod
    def _strip_farmer_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("farmer_name must not be empty")
        return cleaned


class FarmDropdownOption(BaseModel):
    index: int
    label: str


class FarmOptionsResponse(BaseModel):
    state: list[FarmDropdownOption] = Field(default_factory=list)
    category: list[FarmDropdownOption] = Field(default_factory=list)
    district: list[FarmDropdownOption] = Field(default_factory=list)
    taluka: list[FarmDropdownOption] = Field(default_factory=list)
    village: list[FarmDropdownOption] = Field(default_factory=list)
    plot: list[FarmDropdownOption] = Field(default_factory=list)
    selected: dict[str, int] = Field(default_factory=dict)


class FarmProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farmer_name: str
    owner_names: list[str]
    survey_numbers: list[str]
    area_values: list[str]
    farm_area_hectares: float
    extent: list[float]
    polygon: list[list[float]]
    centroid_latitude: float
    centroid_longitude: float

    state_index: int
    category_index: int
    district_index: int
    taluka_index: int
    village_index: int
    plot_index: int
    state_name: str | None = None
    category_name: str | None = None
    district_name: str | None = None
    taluka_name: str | None = None
    village_name: str | None = None
    plot_name: str | None = None

    screenshot_data_url: str | None = None
    screenshot_path: str | None = None
    automation_source: str
    automation_status_message: str | None = None
    created_at: datetime
    updated_at: datetime


class FarmProfileListResponse(BaseModel):
    items: list[FarmProfileRead]
    limit: int
    offset: int
