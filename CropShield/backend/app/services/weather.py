from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from time import monotonic

import httpx

from app.core.config import get_settings


class _WeatherProviderClient:
    _resolve_cache: dict[str, tuple[tuple[float, float, str], float]] = {}
    _response_cache: dict[str, tuple[dict[str, object], float]] = {}
    _resolve_ttl_seconds = 1800.0
    _response_ttl_seconds = 180.0

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.openweather_api_key
        self.base_url = settings.openweather_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def _get(self, path: str, params: dict[str, object]) -> dict[str, object]:
        if not self.api_key:
            raise RuntimeError("OPENWEATHER_API_KEY not configured")
        cache_key = f"{path}?" + "&".join(f"{key}={params[key]}" for key in sorted(params))
        cached = self._response_cache.get(cache_key)
        now = monotonic()
        if cached and cached[1] > now:
            return cached[0]

        query = {**params, "appid": self.api_key, "units": "metric"}
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(f"{self.base_url}{path}", params=query)
            response.raise_for_status()
            payload = response.json()
            normalized = payload if isinstance(payload, dict) else {}
            self._response_cache[cache_key] = (normalized, now + self._response_ttl_seconds)
            return normalized

    async def resolve_location(self, location: str) -> tuple[float, float, str] | None:
        if not self.api_key:
            return None
        normalized_location = location.strip().lower()
        cached = self._resolve_cache.get(normalized_location)
        now = monotonic()
        if cached and cached[1] > now:
            return cached[0]

        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(
                f"{self.base_url}/geo/1.0/direct",
                params={"q": location, "limit": 1, "appid": self.api_key},
            )
            response.raise_for_status()
            payload = response.json()
        if not isinstance(payload, list) or not payload:
            return None
        first = payload[0] if isinstance(payload[0], dict) else None
        if not first:
            return None
        lat = float(first.get("lat", 0.0))
        lon = float(first.get("lon", 0.0))
        resolved = str(first.get("name") or location)
        result = (lat, lon, resolved)
        self._resolve_cache[normalized_location] = (result, now + self._resolve_ttl_seconds)
        return result

    async def current(self, lat: float, lon: float) -> dict[str, object]:
        return await self._get("/data/2.5/weather", {"lat": lat, "lon": lon})

    async def forecast(self, lat: float, lon: float) -> dict[str, object]:
        return await self._get("/data/2.5/forecast", {"lat": lat, "lon": lon})

    async def one_call(self, lat: float, lon: float) -> dict[str, object]:
        return await self._get("/data/3.0/onecall", {"lat": lat, "lon": lon, "exclude": "minutely,hourly"})


def _fallback_current(location: str) -> dict[str, object]:
    return {
        "location": location,
        "temperature_c": 29.2,
        "condition": "Partly cloudy",
        "humidity_percent": 62,
        "wind_kph": 13.4,
        "observed_at": datetime.now(tz=timezone.utc),
    }


def _fallback_forecast(location: str, days: int) -> dict[str, object]:
    forecast_days: list[dict[str, object]] = []
    for offset in range(days):
        day = datetime.now(tz=timezone.utc).date() + timedelta(days=offset)
        forecast_days.append(
            {
                "date": day.isoformat(),
                "min_temp_c": 22.0 + (offset * 0.2),
                "max_temp_c": 31.0 + (offset * 0.3),
                "condition": "Partly cloudy" if offset % 2 == 0 else "Clear",
            }
        )
    return {"location": location, "days": forecast_days}


def _fallback_alerts(location: str) -> dict[str, object]:
    return {
        "location": location,
        "alerts": [
            {
                "title": "Heat advisory",
                "severity": "moderate",
                "description": "High daytime temperatures expected. Increase irrigation checks.",
            }
        ],
    }


class WeatherServiceAdapter:
    def __init__(self) -> None:
        self.provider = _WeatherProviderClient()

    async def current(self, *, location: str) -> dict[str, object]:
        if not self.provider.enabled:
            return _fallback_current(location)

        try:
            resolved = await self.provider.resolve_location(location)
            if not resolved:
                return _fallback_current(location)
            lat, lon, resolved_name = resolved
            payload = await self.provider.current(lat, lon)
            weather_items = payload.get("weather")
            main = payload.get("main")
            wind = payload.get("wind")
            observed_at = payload.get("dt")
            return {
                "location": resolved_name,
                "temperature_c": float(main.get("temp", 0.0)) if isinstance(main, dict) else 0.0,
                "condition": str(weather_items[0].get("main", "Unknown")) if isinstance(weather_items, list) and weather_items and isinstance(weather_items[0], dict) else "Unknown",
                "humidity_percent": int(main.get("humidity", 0)) if isinstance(main, dict) else 0,
                "wind_kph": float(wind.get("speed", 0.0)) * 3.6 if isinstance(wind, dict) else 0.0,
                "observed_at": datetime.fromtimestamp(int(observed_at), tz=timezone.utc) if isinstance(observed_at, (int, float)) else datetime.now(tz=timezone.utc),
            }
        except Exception:
            return _fallback_current(location)

    async def forecast(self, *, location: str, days: int) -> dict[str, object]:
        if not self.provider.enabled:
            return _fallback_forecast(location, days)

        try:
            resolved = await self.provider.resolve_location(location)
            if not resolved:
                return _fallback_forecast(location, days)
            lat, lon, resolved_name = resolved
            payload = await self.provider.forecast(lat, lon)
            rows = payload.get("list")
            if not isinstance(rows, list):
                return _fallback_forecast(location, days)

            grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
            for row in rows:
                if not isinstance(row, dict):
                    continue
                stamp = row.get("dt")
                if not isinstance(stamp, (int, float)):
                    continue
                day_key = datetime.fromtimestamp(int(stamp), tz=timezone.utc).date().isoformat()
                grouped[day_key].append(row)

            day_keys = sorted(grouped.keys())[:days]
            forecast_days: list[dict[str, object]] = []
            for day_key in day_keys:
                rows_for_day = grouped[day_key]
                min_t = min(
                    float(item.get("main", {}).get("temp_min", item.get("main", {}).get("temp", 0.0)))
                    for item in rows_for_day
                    if isinstance(item.get("main"), dict)
                )
                max_t = max(
                    float(item.get("main", {}).get("temp_max", item.get("main", {}).get("temp", 0.0)))
                    for item in rows_for_day
                    if isinstance(item.get("main"), dict)
                )
                condition = "Unknown"
                first_weather = rows_for_day[0].get("weather") if rows_for_day else None
                if isinstance(first_weather, list) and first_weather and isinstance(first_weather[0], dict):
                    condition = str(first_weather[0].get("main", "Unknown"))
                forecast_days.append(
                    {
                        "date": day_key,
                        "min_temp_c": min_t,
                        "max_temp_c": max_t,
                        "condition": condition,
                    }
                )

            if not forecast_days:
                return _fallback_forecast(location, days)
            return {"location": resolved_name, "days": forecast_days}
        except Exception:
            return _fallback_forecast(location, days)

    async def alerts(self, *, location: str) -> dict[str, object]:
        if not self.provider.enabled:
            return _fallback_alerts(location)

        try:
            resolved = await self.provider.resolve_location(location)
            if not resolved:
                return _fallback_alerts(location)
            lat, lon, resolved_name = resolved
            payload = await self.provider.one_call(lat, lon)
            alerts_payload = payload.get("alerts")
            if not isinstance(alerts_payload, list):
                return {"location": resolved_name, "alerts": []}

            alerts: list[dict[str, object]] = []
            for alert in alerts_payload[:8]:
                if not isinstance(alert, dict):
                    continue
                title = str(alert.get("event") or "Weather alert")
                description = str(alert.get("description") or "Weather warning issued by upstream provider.")
                alerts.append(
                    {
                        "title": title,
                        "severity": "moderate",
                        "description": description,
                    }
                )
            return {"location": resolved_name, "alerts": alerts}
        except Exception:
            return _fallback_alerts(location)
