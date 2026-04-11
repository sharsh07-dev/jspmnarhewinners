from __future__ import annotations

from datetime import date, datetime, timedelta
from io import BytesIO
from pathlib import Path
from typing import Tuple

import matplotlib.pyplot as plt
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
MODEL_DIR = PROJECT_ROOT / "models"


def ensure_project_directories() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)


def parse_damage_date(value: date | datetime | str) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    return datetime.strptime(str(value), "%Y-%m-%d")


def date_window(center_date: date | datetime | str, days_before: int, days_after: int) -> Tuple[str, str]:
    parsed = parse_damage_date(center_date)
    start = parsed - timedelta(days=days_before)
    end = parsed + timedelta(days=days_after)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def get_date_ranges(
    damage_date: str,
    gap_before: int = 5,
    gap_after: int = 5,
    window_days: int = 10,
) -> Tuple[str, str, str, str]:
    """Return before/after windows for crop damage comparison.

    Before:  damage_date - (gap_before + window_days)  to  damage_date - gap_before
    After:   damage_date + gap_after                   to  damage_date + gap_after + window_days

    Args:
        damage_date: ISO date string for the damage event.
        gap_before: Days to skip immediately before the damage date (exclusion buffer).
        gap_after: Days to skip immediately after the damage date (exclusion buffer).
        window_days: Width of each search window in days.
    """
    parsed = parse_damage_date(damage_date)
    before_start = (parsed - timedelta(days=gap_before + window_days)).strftime("%Y-%m-%d")
    before_end = (parsed - timedelta(days=gap_before)).strftime("%Y-%m-%d")
    after_start = (parsed + timedelta(days=gap_after)).strftime("%Y-%m-%d")
    after_end = (parsed + timedelta(days=gap_after + window_days)).strftime("%Y-%m-%d")
    return before_start, before_end, after_start, after_end


def point_buffer_meters(area_hectares: float) -> float:
    safe_area = max(area_hectares, 0.5)
    area_sq_m = safe_area * 10000.0
    radius = np.sqrt(area_sq_m / np.pi)
    return float(max(radius, 180.0))


def normalize_rgb(image: np.ndarray) -> np.ndarray:
    image = image.astype(np.float32)
    valid = image[np.isfinite(image) & (image > 0.0)]
    if valid.size == 0:
        return np.zeros_like(np.nan_to_num(image, nan=0.0), dtype=np.float32)

    low = float(np.percentile(valid, 2))
    high = float(np.percentile(valid, 98))
    if high <= low:
        high = low + 1.0
    safe = np.nan_to_num(image, nan=0.0)
    stretched = np.clip((safe - low) / (high - low), 0.0, 1.0)
    return stretched


def fig_to_png_bytes(fig) -> bytes:
    buffer = BytesIO()
    fig.savefig(buffer, format="png", dpi=180, bbox_inches="tight")
    plt.close(fig)
    buffer.seek(0)
    return buffer.getvalue()


def array_to_png_bytes(image: np.ndarray, title: str | None = None, cmap: str | None = None) -> bytes:
    fig, ax = plt.subplots(figsize=(4.5, 4.5))
    if cmap:
        ax.imshow(image, cmap=cmap)
    else:
        ax.imshow(image)
    if title:
        ax.set_title(title)
    ax.axis("off")
    buffer = BytesIO()
    fig.savefig(buffer, format="png", dpi=180, bbox_inches="tight")
    plt.close(fig)
    buffer.seek(0)
    return buffer.getvalue()
