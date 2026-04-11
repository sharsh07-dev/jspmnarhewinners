from __future__ import annotations

import numpy as np
import pytest

from app.services.satellite import SatelliteService


@pytest.mark.asyncio
async def test_earth_engine_unavailable_uses_demo_mode() -> None:
    service = SatelliteService(redis_client=None)
    before_a, after_a, status_a = await service.fetch_satellite_pair(
        latitude=18.5204,
        longitude=73.8567,
        damage_date="2023-08-01",
        area_hectares=2.5,
        gap_before=5,
        gap_after=5,
        window_days=10,
        max_cloud_threshold=100,
        upscale_factor=1,
    )
    before_b, after_b, status_b = await service.fetch_satellite_pair(
        latitude=18.5204,
        longitude=73.8567,
        damage_date="2023-08-01",
        area_hectares=2.5,
        gap_before=5,
        gap_after=5,
        window_days=10,
        max_cloud_threshold=100,
        upscale_factor=1,
    )

    assert "demo mode" in status_a.lower()
    assert "demo mode" in status_b.lower()
    assert before_a.source == "Demo synthetic scene"
    assert after_a.source == "Demo synthetic scene"
    assert np.allclose(before_a.rgb_image, before_b.rgb_image)
    assert np.allclose(after_a.rgb_image, after_b.rgb_image)
