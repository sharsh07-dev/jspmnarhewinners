from __future__ import annotations

from pydantic import BaseModel

from app.schemas.market import CommodityListResponse, MandiDataResponse, TrendingCommoditiesResponse
from app.schemas.weather import WeatherAlertsResponse, WeatherCurrentResponse, WeatherForecastResponse


class DashboardSummaryResponse(BaseModel):
    total_claims: int
    approved_claims: int
    average_damage_percentage: float
    average_decision_confidence: float


class DashboardHomeSignalsResponse(BaseModel):
    summary: DashboardSummaryResponse
    weather_current: WeatherCurrentResponse
    weather_forecast: WeatherForecastResponse
    weather_alerts: WeatherAlertsResponse
    market_commodities: CommodityListResponse
    market_trending: TrendingCommoditiesResponse
    market_mandi_data: MandiDataResponse
