from __future__ import annotations

import asyncio
import logging
import os
import pickle
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import numpy as np
from redis.asyncio import Redis

from app.core.config import get_settings
from app.utils.cache import build_cache_key
from app.utils.domain_helpers import enhance_image, get_date_ranges, normalize_rgb, parse_damage_date, point_buffer_meters

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class SceneData:
    image_date: str
    source: str
    bands: dict[str, np.ndarray]
    rgb_image: np.ndarray


class SatelliteService:
    def __init__(self, redis_client: Redis | None = None) -> None:
        self.settings = get_settings()
        self.redis = redis_client

    async def fetch_satellite_pair(
        self,
        *,
        latitude: float,
        longitude: float,
        damage_date: str,
        area_hectares: float,
        gap_before: int,
        gap_after: int,
        window_days: int,
        max_cloud_threshold: int,
        upscale_factor: int,
    ) -> tuple[SceneData, SceneData, str]:
        cache_payload = {
            "lat": round(latitude, 6),
            "lon": round(longitude, 6),
            "damage_date": damage_date,
            "area": round(area_hectares, 3),
            "gap_before": gap_before,
            "gap_after": gap_after,
            "window_days": window_days,
            "max_cloud_threshold": max_cloud_threshold,
            "upscale_factor": upscale_factor,
            "ee_enabled": self.settings.enable_earth_engine,
        }
        cache_key = build_cache_key("scene_lookup", cache_payload)

        if self.redis is not None:
            try:
                cached = await asyncio.wait_for(self.redis.get(cache_key), timeout=2)
                if cached:
                    before_scene, after_scene, status = pickle.loads(cached)
                    return before_scene, after_scene, status
            except Exception as exc:
                logger.debug("Skipping satellite cache lookup due to Redis issue: %s", exc)

        before_start, before_end, after_start, after_end = get_date_ranges(
            damage_date,
            gap_before=gap_before,
            gap_after=gap_after,
            window_days=window_days,
        )

        ee_ready, ee_message = self._initialize_earth_engine_non_interactive()
        parsed_date = parse_damage_date(damage_date)
        if ee_ready:
            try:
                before_scene, before_cloud = self._fetch_earth_engine_scene_in_window(
                    latitude=latitude,
                    longitude=longitude,
                    start_date=before_start,
                    end_date=before_end,
                    area_hectares=area_hectares,
                    sort_ascending=False,
                    max_cloud_threshold=max_cloud_threshold,
                    upscale_factor=upscale_factor,
                )
                after_scene, after_cloud = self._fetch_earth_engine_scene_in_window(
                    latitude=latitude,
                    longitude=longitude,
                    start_date=after_start,
                    end_date=after_end,
                    area_hectares=area_hectares,
                    sort_ascending=True,
                    max_cloud_threshold=max_cloud_threshold,
                    upscale_factor=upscale_factor,
                )
                status_message = (
                    f"{ee_message} Using windows before={before_start}..{before_end} and after={after_start}..{after_end}. "
                    f"Cloud thresholds used: before<={before_cloud}%, after<={after_cloud}%."
                )
                await self._set_cache(cache_key, before_scene, after_scene, status_message)
                return before_scene, after_scene, status_message
            except Exception as exc:
                logger.warning("Earth Engine lookup failed: %s", exc)
                if not self.settings.allow_demo_satellite_fallback:
                    raise RuntimeError(
                        "Real satellite imagery lookup failed and demo fallback is disabled. "
                        f"Details: {exc}"
                    ) from exc
                ee_message = (
                    "No usable Sentinel-2 scene was found in selected windows. "
                    f"Before={before_start}..{before_end}, After={after_start}..{after_end}. "
                    f"Details: {exc}. Running deterministic demo mode."
                )
        elif not self.settings.allow_demo_satellite_fallback:
            raise RuntimeError(
                "Earth Engine is unavailable and demo fallback is disabled. "
                f"Details: {ee_message}"
            )

        seed = self._deterministic_seed(latitude, longitude, damage_date)
        before_scene = self._scene_from_bands(
            self._generate_demo_bands(seed, degraded=False),
            image_date=(parsed_date - timedelta(days=15)).strftime("%Y-%m-%d"),
            source="Demo synthetic scene",
            upscale_factor=upscale_factor,
        )
        after_scene = self._scene_from_bands(
            self._generate_demo_bands(seed + 17, degraded=True),
            image_date=(parsed_date + timedelta(days=15)).strftime("%Y-%m-%d"),
            source="Demo synthetic scene",
            upscale_factor=upscale_factor,
        )
        await self._set_cache(cache_key, before_scene, after_scene, ee_message)
        return before_scene, after_scene, ee_message

    async def _set_cache(self, key: str, before_scene: SceneData, after_scene: SceneData, status: str) -> None:
        if self.redis is None:
            return
        ttl = self.settings.scene_cache_ttl_seconds
        try:
            await asyncio.wait_for(
                self.redis.setex(key, ttl, pickle.dumps((before_scene, after_scene, status))),
                timeout=2,
            )
        except Exception as exc:
            logger.debug("Skipping satellite cache write due to Redis issue: %s", exc)

    def _deterministic_seed(self, latitude: float, longitude: float, damage_date: str) -> int:
        return int(abs(latitude * 1000) + abs(longitude * 1000) + int(damage_date.replace("-", "")))

    def _generate_demo_bands(self, seed: int, degraded: bool) -> dict[str, np.ndarray]:
        rng = np.random.default_rng(seed)
        grid_x, grid_y = np.meshgrid(np.linspace(-1, 1, 96), np.linspace(-1, 1, 96))
        vegetation_blob = np.exp(-4 * (grid_x**2 + grid_y**2))
        patch_noise = rng.normal(0.0, 0.05, size=vegetation_blob.shape)

        red = 0.20 + 0.08 * (1 - vegetation_blob) + patch_noise
        green = 0.36 + 0.20 * vegetation_blob + patch_noise
        blue = 0.18 + 0.05 * (1 - vegetation_blob) + patch_noise
        nir = 0.60 + 0.25 * vegetation_blob + patch_noise

        if degraded:
            stress_mask = (grid_x > -0.2) & (grid_y < 0.45)
            nir = nir - (0.22 * stress_mask) - 0.12
            red = red + 0.12 * stress_mask
            green = green - 0.10 * stress_mask

        return {
            "B2": np.clip(blue, 0.01, 1.0).astype(np.float32),
            "B3": np.clip(green, 0.01, 1.0).astype(np.float32),
            "B4": np.clip(red, 0.01, 1.0).astype(np.float32),
            "B8": np.clip(nir, 0.01, 1.0).astype(np.float32),
        }

    def _scene_from_bands(self, bands: dict[str, np.ndarray], image_date: str, source: str, upscale_factor: int) -> SceneData:
        rgb = normalize_rgb(np.dstack([bands["B4"], bands["B3"], bands["B2"]]))
        rgb = enhance_image(rgb, upscale_factor=upscale_factor)
        return SceneData(image_date=image_date, source=source, bands=bands, rgb_image=rgb)

    def _initialize_earth_engine_non_interactive(self) -> tuple[bool, str]:
        if not self.settings.enable_earth_engine:
            return False, "Earth Engine disabled by configuration. Running demo mode."

        try:
            import ee  # type: ignore
        except ImportError:
            return False, "earthengine-api not installed. Running demo mode."

        project = self.settings.earth_engine_project or os.environ.get("GOOGLE_CLOUD_PROJECT")
        try:
            if project:
                ee.Initialize(project=project)
                return True, f"Earth Engine initialized with project '{project}'."
            ee.Initialize()
            return True, "Earth Engine initialized with default credentials."
        except Exception as exc:
            return False, f"Earth Engine unavailable: {exc}. Running demo mode."

    def _fetch_earth_engine_scene_in_window(
        self,
        *,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str,
        area_hectares: float,
        sort_ascending: bool,
        max_cloud_threshold: int,
        upscale_factor: int,
    ) -> tuple[SceneData, int]:
        start_dt = parse_damage_date(start_date)
        end_dt = parse_damage_date(end_date)
        today = datetime.utcnow().date()
        if end_dt.date() > today:
            end_dt = datetime.combine(today, datetime.min.time())
        if start_dt > end_dt:
            start_dt = end_dt - timedelta(days=7)

        candidate_thresholds = [20, 35, 50, 70, 90, 100]
        thresholds = [item for item in candidate_thresholds if item <= max_cloud_threshold]
        if not thresholds:
            thresholds = [max_cloud_threshold]
        # Final fallback: allow one pass with 100% cloud metadata filter, cloud masking still applies later.
        if 100 not in thresholds:
            thresholds.append(100)

        expansion_days = [0, 7, 14, 30]
        last_error: Exception | None = None
        attempted_windows: list[str] = []

        for days in expansion_days:
            attempt_start_dt = start_dt - timedelta(days=days)
            attempt_end_dt = min(end_dt + timedelta(days=days), datetime.combine(today, datetime.min.time()))
            attempt_start = attempt_start_dt.strftime("%Y-%m-%d")
            attempt_end = attempt_end_dt.strftime("%Y-%m-%d")
            attempted_windows.append(f"{attempt_start}..{attempt_end}")

            for cloud_threshold in thresholds:
                try:
                    scene = self._fetch_earth_engine_scene(
                        latitude=latitude,
                        longitude=longitude,
                        start_date=attempt_start,
                        end_date=attempt_end,
                        area_hectares=area_hectares,
                        sort_ascending=sort_ascending,
                        cloud_threshold=cloud_threshold,
                        upscale_factor=upscale_factor,
                    )
                    return scene, cloud_threshold
                except Exception as exc:
                    last_error = exc

        if last_error:
            raise ValueError(
                f"No Sentinel-2 scene found for window {start_date}..{end_date} "
                f"(expanded attempts: {', '.join(attempted_windows)}) up to cloud <= 100%."
            ) from last_error
        raise ValueError(f"No Sentinel-2 scene found for window {start_date}..{end_date}.")

    def _fetch_earth_engine_scene(
        self,
        *,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str,
        area_hectares: float,
        sort_ascending: bool,
        cloud_threshold: int,
        upscale_factor: int,
    ) -> SceneData:
        import ee  # type: ignore

        def _mask_clouds_and_shadows(image: Any) -> Any:
            scl = image.select("SCL")
            scl_clear = scl.neq(0).And(scl.neq(1)).And(scl.neq(3)).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10))
            qa60 = image.select("QA60")
            qa_clear = qa60.bitwiseAnd(1 << 10).eq(0).And(qa60.bitwiseAnd(1 << 11).eq(0))
            return image.updateMask(scl_clear.And(qa_clear))

        radius = point_buffer_meters(area_hectares)
        point = ee.Geometry.Point([longitude, latitude])
        region = point.buffer(radius).bounds()

        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(point)
            .filterDate(start_date, (parse_damage_date(end_date) + timedelta(days=1)).strftime("%Y-%m-%d"))
            .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", cloud_threshold))
            .sort("system:time_start", sort_ascending)
        )
        masked_collection = collection.map(_mask_clouds_and_shadows)
        first_image = ee.Image(collection.first())
        info = first_image.getInfo()
        if not info:
            raise ValueError("No scenes found in this window.")

        native_projection = first_image.select("B2").projection()
        image = ee.Image(masked_collection.median()).setDefaultProjection(native_projection).clip(region)
        sampled = image.select(["B2", "B3", "B4", "B8"]).sampleRectangle(region=region, defaultValue=0).getInfo()
        properties = sampled.get("properties", {})
        bands = {
            band: np.asarray(properties[band], dtype=np.float32)
            for band in ["B2", "B3", "B4", "B8"]
        }
        valid_ratio = float(np.mean(np.logical_and.reduce([bands[b] > 0 for b in ["B2", "B3", "B4", "B8"]])))
        source_label = "Google Earth Engine (cloud-masked composite)"
        
        # If cloud masking is too aggressive (e.g. 100% cloud cover in median), 
        # fallback to the single clearest scene available in the collection.
        if valid_ratio < 0.10:
            logger.info("Cloud masking removed too many pixels (valid ratio %.2f). Falling back to clearest single scene.", valid_ratio)
            # Pick the image with the absolute lowest cloud percentage metadata
            clearest_image = ee.Image(collection.sort("CLOUDY_PIXEL_PERCENTAGE").first())
            image = clearest_image.setDefaultProjection(native_projection).clip(region)
            sampled = image.select(["B2", "B3", "B4", "B8"]).sampleRectangle(region=region, defaultValue=0).getInfo()
            properties = sampled.get("properties", {})
            bands = {
                band: np.asarray(properties[band], dtype=np.float32)
                for band in ["B2", "B3", "B4", "B8"]
            }
            source_label = "Google Earth Engine (clearest scene fallback)"

        reflectance = {band: np.where(array > 0, array / 10000.0, np.nan) for band, array in bands.items()}
        time_start_ms = info["properties"].get("system:time_start")
        if isinstance(time_start_ms, (int, float)):
            image_date = datetime.utcfromtimestamp(time_start_ms / 1000.0).strftime("%Y-%m-%d")
        else:
            image_date = start_date
        return self._scene_from_bands(
            reflectance,
            image_date=image_date,
            source=source_label,
            upscale_factor=upscale_factor,
        )
