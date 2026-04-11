from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "CropShield-AI Backend"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"
    cors_allow_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"],
        description="Allowed CORS origins. Supports JSON array or comma-separated string.",
    )
    cors_allow_methods: list[str] = Field(
        default_factory=lambda: ["*"],
        description="Allowed CORS methods.",
    )
    cors_allow_headers: list[str] = Field(
        default_factory=lambda: ["*"],
        description="Allowed CORS headers.",
    )
    cors_allow_credentials: bool = False

    database_url: str = Field(
        default="postgresql+asyncpg://crop:crop@localhost:5432/cropshield",
        description="Async SQLAlchemy URL.",
    )
    sync_database_url: str = Field(
        default="postgresql+psycopg://crop:crop@localhost:5432/cropshield",
        description="Sync URL used by Alembic and one-off scripts.",
    )
    redis_url: str = "redis://localhost:6379/0"

    celery_broker_url: str | None = None
    celery_result_backend: str | None = None
    enable_inline_jobs: bool = True
    enable_weather_module: bool = True
    enable_market_module: bool = True
    enable_advisory_module: bool = True
    enable_forum_module: bool = True
    enable_disease_module: bool = True

    grok_api_key: str | None = None
    grok_base_url: str = "https://api.x.ai/v1"
    grok_model: str = "grok-2-latest"
    grok_timeout_seconds: float = 20.0
    groq_api_key: str | None = None
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "llama-3.1-8b-instant"

    openweather_api_key: str | None = None
    openweather_base_url: str = "https://api.openweathermap.org"
    data_gov_in_api_key: str | None = None
    data_gov_in_base_url: str = "https://api.data.gov.in"
    data_gov_in_market_resource_id: str = "9ef84268-d588-465a-a308-a864a43d0070"

    # Domain defaults preserved from the Streamlit prototype.
    default_gap_before_days: int = 5
    default_gap_after_days: int = 5
    default_window_days: int = 10
    default_max_cloud_threshold: int = 100
    default_upscale_factor: int = 4

    scene_cache_ttl_seconds: int = 3600
    dashboard_cache_ttl_seconds: int = 120
    report_metadata_cache_ttl_seconds: int = 300

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    admin_username: str = "admin"
    admin_password: str = "admin"
    google_client_id: str | None = None

    earth_engine_project: str | None = None
    enable_earth_engine: bool = True
    allow_demo_satellite_fallback: bool = False
    allow_heuristic_ai_fallback: bool = False
    require_trained_ai_model: bool = True
    ai_model_path: str = "models/crop_damage_cnn.keras"
    google_api_key: str | None = None

    report_artifacts_dir: str = "data/artifacts"
    rules_version: str = "v1-streamlit-compatible"
    ai_model_version: str = "heuristic-v1"

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    @property
    def backend_root(self) -> Path:
        return Path(__file__).resolve().parents[2]

    @property
    def artifacts_dir(self) -> Path:
        raw = Path(self.report_artifacts_dir)
        return raw if raw.is_absolute() else (self.project_root / raw)

    @property
    def effective_celery_broker(self) -> str:
        return self.celery_broker_url or self.redis_url

    @property
    def effective_celery_result_backend(self) -> str:
        return self.celery_result_backend or self.redis_url

    @field_validator("cors_allow_origins", "cors_allow_methods", "cors_allow_headers", mode="before")
    @classmethod
    def parse_env_list(cls, value: object) -> object:
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except json.JSONDecodeError:
                    pass
            return [part.strip() for part in raw.split(",") if part.strip()]
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
