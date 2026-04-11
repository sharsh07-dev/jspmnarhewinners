# CropShield-AI Backend Architecture Note

This backend replaces the `app.py` Streamlit monolith with a production-oriented FastAPI service and async workers.

## Why This Is Better Than The Current Repo

1. API and domain logic are now separated:
- `app/api/v1/routes` handles HTTP contracts.
- `app/services` handles domain orchestration (satellite -> indices -> AI -> decision -> report).
- `app/repositories` isolates persistence.

2. Persistence moved from a denormalized SQLite table to normalized PostgreSQL tables:
- `claims`, `analysis_runs`, `index_metrics`, `ai_predictions`, `decisions`, `reports`, and `job_status`.
- Better queryability, historical tracking, and clearer ownership of each stage.

3. Long-running work no longer blocks request threads:
- Celery workers execute analysis and report generation.
- `/api/v1/jobs/{job_id}` exposes queued/running/failed/completed status.

4. Redis is used meaningfully:
- Celery broker/result backend.
- Scene lookup cache for expensive satellite fetches.
- Dashboard summary cache and report metadata cache.

5. Domain behavior from the original modules is preserved:
- date-window strategy (`gap_before`, `gap_after`, `window_days`),
- NDVI/NDWI/EVI calculations,
- deterministic demo fallback when Earth Engine is unavailable,
- rule-based decision logic,
- PDF report generation.

6. Migration path is explicit:
- `scripts/import_legacy_sqlite.py` imports `data/claims.db` records into the new schema.

## Optional Enhancement

- PostGIS can be added later for spatial indexing and geospatial query acceleration (for example, clustering claims by affected region), but the first production-ready version ships without making PostGIS a blocker.
