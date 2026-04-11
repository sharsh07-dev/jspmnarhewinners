from __future__ import annotations

from typing import Any
from time import monotonic

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.repositories.claims import ClaimRepository


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in record.items():
        normalized_key = str(key).strip().lower().replace(" ", "_")
        normalized[normalized_key] = value
    return normalized


class _MarketProviderClient:
    _records_cache: dict[int, tuple[list[dict[str, Any]], float]] = {}
    _records_ttl_seconds = 180.0

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.data_gov_in_api_key
        self.base_url = settings.data_gov_in_base_url.rstrip("/")
        self.resource_id = settings.data_gov_in_market_resource_id

    @property
    def enabled(self) -> bool:
        return bool(self.api_key and self.resource_id)

    async def fetch_records(self, limit: int = 50) -> list[dict[str, Any]]:
        if not self.enabled:
            return []

        cached = self._records_cache.get(limit)
        now = monotonic()
        if cached and cached[1] > now:
            return cached[0]

        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(
                f"{self.base_url}/resource/{self.resource_id}",
                params={
                    "api-key": self.api_key,
                    "format": "json",
                    "limit": limit,
                },
            )
            response.raise_for_status()
            payload = response.json()

        if not isinstance(payload, dict):
            return []
        records = payload.get("records")
        if not isinstance(records, list):
            return []
        normalized = [item for item in records if isinstance(item, dict)]
        self._records_cache[limit] = (normalized, now + self._records_ttl_seconds)
        return normalized


def _fallback_commodities() -> dict[str, object]:
    return {
        "items": [
            {
                "commodity": "Wheat",
                "market": "Delhi",
                "unit": "quintal",
                "price": 2450.0,
                "currency": "INR",
            },
            {
                "commodity": "Rice",
                "market": "Pune",
                "unit": "quintal",
                "price": 2685.0,
                "currency": "INR",
            },
        ]
    }


def _fallback_trending() -> dict[str, object]:
    return {
        "items": [
            {"commodity": "Soybean", "change_percent": 3.8},
            {"commodity": "Cotton", "change_percent": -1.2},
        ]
    }


def _fallback_mandi_data() -> dict[str, object]:
    return {
        "items": [
            {
                "mandi": "Azadpur",
                "commodity": "Tomato",
                "min_price": 850.0,
                "max_price": 1320.0,
                "modal_price": 1090.0,
            },
            {
                "mandi": "Nashik",
                "commodity": "Onion",
                "min_price": 780.0,
                "max_price": 1180.0,
                "modal_price": 1010.0,
            },
        ]
    }


class MarketServiceAdapter:
    def __init__(self) -> None:
        self.provider = _MarketProviderClient()

    async def commodities(self) -> dict[str, object]:
        if not self.provider.enabled:
            return _fallback_commodities()

        try:
            records = await self.provider.fetch_records(limit=30)
            items: list[dict[str, object]] = []
            for raw in records:
                row = _normalize_record(raw)
                commodity = str(row.get("commodity") or row.get("variety") or "Unknown")
                market = str(row.get("market") or row.get("district") or "Unknown")
                modal = _to_float(row.get("modal_price"))
                if modal is None:
                    continue
                items.append(
                    {
                        "commodity": commodity,
                        "market": market,
                        "unit": "quintal",
                        "price": modal,
                        "currency": "INR",
                    }
                )
                if len(items) >= 10:
                    break
            return {"items": items} if items else _fallback_commodities()
        except Exception:
            return _fallback_commodities()

    async def trending(self) -> dict[str, object]:
        if not self.provider.enabled:
            return _fallback_trending()

        try:
            records = await self.provider.fetch_records(limit=40)
            items: list[dict[str, object]] = []
            for raw in records:
                row = _normalize_record(raw)
                commodity = str(row.get("commodity") or row.get("variety") or "Unknown")
                minimum = _to_float(row.get("min_price"))
                maximum = _to_float(row.get("max_price"))
                modal = _to_float(row.get("modal_price"))
                if minimum is None or maximum is None or modal is None:
                    continue
                baseline = (minimum + maximum) / 2.0
                if baseline <= 0:
                    continue
                change = ((modal - baseline) / baseline) * 100.0
                items.append({"commodity": commodity, "change_percent": round(change, 2)})
                if len(items) >= 10:
                    break
            return {"items": items} if items else _fallback_trending()
        except Exception:
            return _fallback_trending()

    async def mandi_data(self) -> dict[str, object]:
        if not self.provider.enabled:
            return _fallback_mandi_data()

        try:
            records = await self.provider.fetch_records(limit=40)
            items: list[dict[str, object]] = []
            for raw in records:
                row = _normalize_record(raw)
                commodity = str(row.get("commodity") or row.get("variety") or "Unknown")
                mandi = str(row.get("market") or row.get("district") or "Unknown")
                minimum = _to_float(row.get("min_price"))
                maximum = _to_float(row.get("max_price"))
                modal = _to_float(row.get("modal_price"))
                if minimum is None or maximum is None or modal is None:
                    continue
                items.append(
                    {
                        "mandi": mandi,
                        "commodity": commodity,
                        "min_price": minimum,
                        "max_price": maximum,
                        "modal_price": modal,
                    }
                )
                if len(items) >= 12:
                    break
            return {"items": items} if items else _fallback_mandi_data()
        except Exception:
            return _fallback_mandi_data()

    async def financial_summary(self, *, session: AsyncSession) -> dict[str, object]:
        claims_repo = ClaimRepository(session)
        claims, _ = await claims_repo.list_for_admin(limit=500, offset=0)

        reviewed_claims = [
            claim
            for claim in claims
            if claim.admin_status == "approved" and claim.recommended_insurance_amount is not None
        ]

        if not reviewed_claims:
            return {
                "estimated_revenue_inr": 0.0,
                "estimated_cost_inr": 0.0,
                "estimated_profit_inr": 0.0,
                "margin_percent": 0.0,
                "recommendation": "No approved claims with reviewed amounts yet. Review claims to populate this tab.",
            }

        estimated_revenue = 0.0
        estimated_cost = 0.0
        total_damage = 0.0

        for claim in reviewed_claims:
            approved_amount = float(claim.recommended_insurance_amount or 0.0)
            damage_percentage = 0.0
            latest_analysis = claim.analysis_runs[0] if claim.analysis_runs else None
            if latest_analysis and latest_analysis.metrics is not None:
                damage_percentage = float(latest_analysis.metrics.damage_percentage)

            estimated_revenue += approved_amount
            estimated_cost += approved_amount * (damage_percentage / 100.0)
            total_damage += damage_percentage

        estimated_profit = estimated_revenue - estimated_cost
        margin = (estimated_profit / estimated_revenue) * 100 if estimated_revenue else 0.0
        average_damage = total_damage / len(reviewed_claims)

        if margin >= 75:
            recommendation = "Portfolio reserve looks strong. Continue approving claims with current controls."
        elif margin >= 50:
            recommendation = "Portfolio is balanced. Keep reviewing damage trends before approving additional payouts."
        elif average_damage >= 40:
            recommendation = "Damage intensity is high. Tighten review thresholds and track high-risk crops closely."
        else:
            recommendation = "Review approved claims and damage evidence to improve payout reserve accuracy."

        return {
            "estimated_revenue_inr": round(estimated_revenue, 2),
            "estimated_cost_inr": round(estimated_cost, 2),
            "estimated_profit_inr": round(estimated_profit, 2),
            "margin_percent": round(margin, 2),
            "recommendation": recommendation,
        }
