from __future__ import annotations

import numpy as np

from app.services.indices import calculate_ndvi, compute_damage_percentage


def test_ndvi_output_is_bounded() -> None:
    nir = np.array([[0.6, 0.2], [0.8, 0.4]], dtype=np.float32)
    red = np.array([[0.2, 0.2], [0.1, 0.3]], dtype=np.float32)
    ndvi = calculate_ndvi(nir, red)
    assert ndvi.min() >= -1.0
    assert ndvi.max() <= 1.0


def test_damage_percentage_uses_ndvi_drop() -> None:
    damage = compute_damage_percentage(0.5, 0.2)
    assert round(damage, 2) == 60.0
