from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.utils.domain_helpers import clamp_percentage


@dataclass(slots=True)
class MetricsResult:
    ndvi_before: float
    ndvi_after: float
    ndwi_before: float
    ndwi_after: float
    evi_before: float
    evi_after: float
    damage_percentage: float


def calculate_ndvi(nir_band: np.ndarray, red_band: np.ndarray) -> np.ndarray:
    nir = nir_band.astype(np.float32)
    red = red_band.astype(np.float32)
    denominator = nir + red
    ndvi = np.full_like(denominator, np.nan, dtype=np.float32)
    valid = (np.abs(denominator) >= 1e-6) & np.isfinite(nir) & np.isfinite(red) & ((nir + red) > 0.0)
    ndvi[valid] = (nir[valid] - red[valid]) / denominator[valid]
    return np.clip(ndvi, -1.0, 1.0)


def calculate_ndwi(green_band: np.ndarray, nir_band: np.ndarray) -> np.ndarray:
    green = green_band.astype(np.float32)
    nir = nir_band.astype(np.float32)
    denominator = green + nir
    ndwi = np.full_like(denominator, np.nan, dtype=np.float32)
    valid = (np.abs(denominator) >= 1e-6) & np.isfinite(green) & np.isfinite(nir) & ((green + nir) > 0.0)
    ndwi[valid] = (green[valid] - nir[valid]) / denominator[valid]
    return np.clip(ndwi, -1.0, 1.0)


def calculate_evi(nir_band: np.ndarray, red_band: np.ndarray, blue_band: np.ndarray) -> np.ndarray:
    nir = nir_band.astype(np.float32)
    red = red_band.astype(np.float32)
    blue = blue_band.astype(np.float32)
    denominator = nir + 6.0 * red - 7.5 * blue + 1.0
    evi = np.full_like(denominator, np.nan, dtype=np.float32)
    valid = (np.abs(denominator) >= 1e-6) & np.isfinite(nir) & np.isfinite(red) & np.isfinite(blue)
    evi[valid] = 2.5 * (nir[valid] - red[valid]) / denominator[valid]
    return np.clip(evi, -1.0, 1.0)


def summarize_index(index_map: np.ndarray) -> dict[str, float]:
    valid = index_map[np.isfinite(index_map)]
    if valid.size == 0:
        valid = np.array([0.0], dtype=np.float32)
    return {
        "mean": float(np.mean(valid)),
        "min": float(np.min(valid)),
        "max": float(np.max(valid)),
        "std": float(np.std(valid)),
    }


def compute_damage_percentage(ndvi_before: float, ndvi_after: float) -> float:
    baseline = max(abs(ndvi_before), 1e-6)
    drop = ((ndvi_before - ndvi_after) / baseline) * 100.0
    return clamp_percentage(drop)


def compute_metrics(
    before_bands: dict[str, np.ndarray],
    after_bands: dict[str, np.ndarray],
) -> tuple[MetricsResult, dict[str, np.ndarray]]:
    before_ndvi = calculate_ndvi(before_bands["B8"], before_bands["B4"])
    after_ndvi = calculate_ndvi(after_bands["B8"], after_bands["B4"])
    before_ndwi = calculate_ndwi(before_bands["B3"], before_bands["B8"])
    after_ndwi = calculate_ndwi(after_bands["B3"], after_bands["B8"])
    before_evi = calculate_evi(before_bands["B8"], before_bands["B4"], before_bands["B2"])
    after_evi = calculate_evi(after_bands["B8"], after_bands["B4"], after_bands["B2"])

    summary = MetricsResult(
        ndvi_before=summarize_index(before_ndvi)["mean"],
        ndvi_after=summarize_index(after_ndvi)["mean"],
        ndwi_before=summarize_index(before_ndwi)["mean"],
        ndwi_after=summarize_index(after_ndwi)["mean"],
        evi_before=summarize_index(before_evi)["mean"],
        evi_after=summarize_index(after_evi)["mean"],
        damage_percentage=compute_damage_percentage(
            summarize_index(before_ndvi)["mean"],
            summarize_index(after_ndvi)["mean"],
        ),
    )
    maps = {
        "ndvi_before": before_ndvi,
        "ndvi_after": after_ndvi,
        "ndwi_before": before_ndwi,
        "ndwi_after": after_ndwi,
        "evi_before": before_evi,
        "evi_after": after_evi,
    }
    return summary, maps
