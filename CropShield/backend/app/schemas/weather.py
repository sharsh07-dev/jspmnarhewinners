from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class WeatherCurrentResponse(BaseModel):
    location: str
    temperature_c: float
    condition: str
    humidity_percent: int
    wind_kph: float
    observed_at: datetime


class WeatherForecastDay(BaseModel):
    date: str
    min_temp_c: float
    max_temp_c: float
    condition: str


class WeatherForecastResponse(BaseModel):
    location: str
    days: list[WeatherForecastDay]


class WeatherAlertItem(BaseModel):
    title: str
    severity: str
    description: str


class WeatherAlertsResponse(BaseModel):
    location: str
    alerts: list[WeatherAlertItem]
