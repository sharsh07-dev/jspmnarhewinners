# CropShield-AI Backend

Production-style FastAPI backend for crop insurance analysis and settlement.

## Stack

- FastAPI + Pydantic v2
- SQLAlchemy 2 (async) + Alembic
- PostgreSQL
- Redis
- Celery workers
- Pytest

## File Tree

```text
backend/
  app/
    api/v1/routes/
      claims.py
      dashboard.py
      health.py
      jobs.py
    core/
      config.py
      exceptions.py
      logging.py
      security.py
    db/
      base.py
      session.py
      models/
      migrations/
    repositories/
    schemas/
    services/
    workers/
    utils/
    main.py
  scripts/
    import_legacy_sqlite.py
  tests/
  docker-compose.yml
  Dockerfile
  alembic.ini
  .env.example
```

## Local Run

1. Copy env file:

```powershell
cd backend
Copy-Item .env.example .env
```

2. Start infrastructure + app + worker:

```powershell
docker compose up --build
```

For local development without Docker, you can point the backend at the bundled SQLite database:

```env
DATABASE_URL=sqlite+aiosqlite:///../data/claims.db
SYNC_DATABASE_URL=sqlite:///../data/claims.db
ENABLE_INLINE_JOBS=true
ALLOW_DEMO_SATELLITE_FALLBACK=true
ENABLE_EARTH_ENGINE=false
```

3. Run migrations:

```powershell
docker compose exec api alembic upgrade head
```

4. Open docs:

- `http://localhost:8000/docs`

## Legacy SQLite Import

After migrations:

```powershell
docker compose exec api python scripts/import_legacy_sqlite.py --sqlite-path /app/data/claims.db
```

## Test Run

```powershell
cd backend
pytest
```

## Deploying Without A Celery Worker

If you want to run only a single web service (for example on Render free tier), set:

```env
ENABLE_INLINE_JOBS=true
```

In this mode, analysis/report jobs are executed asynchronously inside the web process, so `/analyze` and `/report` still work without launching a separate Celery worker service.

## CORS For Frontend

When frontend and backend run on different origins (for example `http://localhost:3000` -> Render API), configure CORS in backend env:

```env
CORS_ALLOW_ORIGINS=http://localhost:3000,https://your-frontend-domain.onrender.com
CORS_ALLOW_METHODS=*
CORS_ALLOW_HEADERS=*
CORS_ALLOW_CREDENTIALS=false
```

## Real Satellite + AI Requirements

To run without dummy/synthetic fallback:

```env
ENABLE_EARTH_ENGINE=true
EARTH_ENGINE_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
ALLOW_DEMO_SATELLITE_FALLBACK=false
ALLOW_HEURISTIC_AI_FALLBACK=false
REQUIRE_TRAINED_AI_MODEL=true
AI_MODEL_PATH=models/crop_damage_cnn.keras
```

Credentials needed:

1. Google Earth Engine credentials (service account JSON via `GOOGLE_APPLICATION_CREDENTIALS`, or pre-authenticated runtime identity).
2. Google Cloud project with Earth Engine enabled (`EARTH_ENGINE_PROJECT` or `GOOGLE_CLOUD_PROJECT`).
3. Trained local model file at `AI_MODEL_PATH` (Keras `.keras` file).

No Gemini API key is required by this backend pipeline.
