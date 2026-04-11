from __future__ import annotations

import asyncio
import json
from typing import Any

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.repositories.dashboard import DashboardRepository
from app.services.market import MarketServiceAdapter
from app.services.weather import WeatherServiceAdapter


class DashboardService:
    CACHE_KEY = "dashboard:summary:v1"
    HOME_SIGNALS_CACHE_PREFIX = "dashboard:home-signals:v1"

    def __init__(self, session: AsyncSession, redis_client: Redis | None = None) -> None:
        self.session = session
        self.redis = redis_client
        self.repo = DashboardRepository(session)
        self.settings = get_settings()

    async def get_summary(self) -> dict[str, Any]:
        if self.redis is not None:
            try:
                cached = await asyncio.wait_for(self.redis.get(self.CACHE_KEY), timeout=2)
                if cached:
                    return json.loads(cached.decode("utf-8"))
            except Exception:
                pass

        summary = await self.repo.summary()
        if self.redis is not None:
            ttl = self.settings.dashboard_cache_ttl_seconds
            try:
                await asyncio.wait_for(
                    self.redis.setex(self.CACHE_KEY, ttl, json.dumps(summary).encode("utf-8")),
                    timeout=2,
                )
            except Exception:
                pass
        return summary

    async def get_home_signals(self, *, location: str, forecast_days: int) -> dict[str, Any]:
        cache_key = f"{self.HOME_SIGNALS_CACHE_PREFIX}:{location.strip().lower()}:{forecast_days}"
        if self.redis is not None:
            try:
                cached = await asyncio.wait_for(self.redis.get(cache_key), timeout=2)
                if cached:
                    return json.loads(cached.decode("utf-8"))
            except Exception:
                pass

        weather_service = WeatherServiceAdapter()
        market_service = MarketServiceAdapter()

        summary, weather_current, weather_forecast, weather_alerts, market_commodities, market_trending, market_mandi_data = await asyncio.gather(
            self.get_summary(),
            weather_service.current(location=location),
            weather_service.forecast(location=location, days=forecast_days),
            weather_service.alerts(location=location),
            market_service.commodities(),
            market_service.trending(),
            market_service.mandi_data(),
        )

        payload = {
            "summary": summary,
            "weather_current": weather_current,
            "weather_forecast": weather_forecast,
            "weather_alerts": weather_alerts,
            "market_commodities": market_commodities,
            "market_trending": market_trending,
            "market_mandi_data": market_mandi_data,
        }

        if self.redis is not None:
            ttl = min(self.settings.dashboard_cache_ttl_seconds, 180)
            try:
                await asyncio.wait_for(
                    self.redis.setex(cache_key, ttl, json.dumps(payload, default=str).encode("utf-8")),
                    timeout=2,
                )
            except Exception:
                pass

        return payload

    async def invalidate_summary_cache(self) -> None:
        if self.redis is not None:
            try:
                await asyncio.wait_for(self.redis.delete(self.CACHE_KEY), timeout=2)
            except Exception:
                pass
