from __future__ import annotations

from pydantic import BaseModel


class CommodityPriceItem(BaseModel):
    commodity: str
    market: str
    unit: str
    price: float
    currency: str


class CommodityListResponse(BaseModel):
    items: list[CommodityPriceItem]


class TrendingCommodityItem(BaseModel):
    commodity: str
    change_percent: float


class TrendingCommoditiesResponse(BaseModel):
    items: list[TrendingCommodityItem]


class MandiDataItem(BaseModel):
    mandi: str
    commodity: str
    min_price: float
    max_price: float
    modal_price: float


class MandiDataResponse(BaseModel):
    items: list[MandiDataItem]


class FinancialSummaryResponse(BaseModel):
    estimated_revenue_inr: float
    estimated_cost_inr: float
    estimated_profit_inr: float
    margin_percent: float
    recommendation: str
