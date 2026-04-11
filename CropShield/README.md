# CropShield

CropShield is a crop insurance workflow platform that helps farmers, reviewers, and administrators move from damage reporting to decision-ready evidence in one connected system.

It combines:

- Farmer claim submission and status tracking
- Satellite-based analysis and AI-assisted damage estimation
- Admin review workflows with audit history
- Report generation for review and documentation

This README is written for two audiences:

- Non-technical readers who want to understand what the platform does and why it matters
- Technical readers who need architecture, setup, APIs, and operations detail

---

## 1. Non-Technical Overview

### What problem this solves

Crop damage claims are often slow because information is spread across forms, manual checks, and disconnected data sources. CropShield reduces that delay by organizing the workflow from claim creation through admin decision.

### Who uses CropShield

- Farmers: submit crop damage claims, track progress, provide follow-up notes
- Admin reviewers: review claims, inspect analysis evidence, approve or reject with notes
- Technical teams: operate the platform and integrate with data and reporting pipelines

### How it works in simple terms

1. A farmer submits a claim with crop and location details.
2. The system runs analysis jobs to estimate possible crop damage.
3. The farmer can see claim progress and retry analysis if it fails.
4. Admin users review the claim with supporting metrics and imagery.
5. Admin actions are recorded in an audit log.
6. Reports can be generated and downloaded.

### What the user sees

- Farmer side
	- Request creation flow
	- Request status badges that explain state clearly
	- Retry panel for failed analysis
	- Needs-more-info response form

- Admin side
	- Filterable claims table
	- Pagination
	- Expandable per-claim technical details
	- Bulk approve/reject actions
	- Audit history and report download

---

## 2. Technical Overview

### Core stack

- Backend: FastAPI, SQLAlchemy (async), Alembic, Redis, Celery, Pydantic v2
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS
- Data/ML: NumPy, TensorFlow/Keras model loading, optional Earth Engine integration

### Repository structure

- backend
	- app/api/v1/routes: HTTP routes
	- app/services: domain/business logic
	- app/repositories: data access logic
	- app/schemas: request/response contracts
	- app/db/models: ORM models
	- app/db/migrations: Alembic revisions
	- tests: API and service tests
- frontend
	- src/app: pages/routes
	- src/components: shared UI
	- src/hooks: API hooks
	- src/lib/api.ts: typed API client
	- src/types/api.ts: frontend API contracts
- data
	- artifacts for generated analysis outputs and reports
- models
	- local model artifacts

### Architecture rule

Route -> Service -> Repository -> Database

Routes should not query the database directly.

---

## 3. Main Functional Modules

### Authentication and authorization

- JWT-based auth
- Roles:
	- admin
	- farmer
- Role-scoped access checks on claim and admin routes

### Claim lifecycle

- Create claim
- Trigger analysis
- Poll job progress
- Review status transitions
- Generate and download report

### Farmer data isolation

- Farmer users only access their own claims
- Admin users can access all claims

### Admin workflow enhancements

- Filtered admin listing with total_count
- Full claim detail endpoint for one-call expansion
- Bulk review endpoint
- Claim audit log table and timeline

---

## 4. API Highlights

### Farmer and shared claim endpoints

- POST /api/v1/claims
- GET /api/v1/claims
- GET /api/v1/claims/{id}
- POST /api/v1/claims/{id}/analyze
- GET /api/v1/claims/{id}/analysis
- GET /api/v1/claims/{id}/analysis/artifacts
- PATCH /api/v1/claims/{id}/farmer-notes
- POST /api/v1/claims/{id}/report
- GET /api/v1/claims/{id}/report

### Admin endpoints

- GET /api/v1/admin/claims
	- supports status, admin_status, crop_type, damage_date_from, damage_date_to, search, limit, offset
- GET /api/v1/admin/claims/{id}/full
- PATCH /api/v1/admin/claims/{id}/review
- PATCH /api/v1/admin/claims/bulk-review
- GET /api/v1/admin/claims/{id}/report?download=true

### Health endpoints

- GET /api/v1/health
- GET /api/v1/ready

Interactive API docs: http://localhost:8000/docs

---

## 5. Local Setup (Windows, PowerShell)

### Prerequisites

- Python 3.11+
- Node.js 20+
- npm
- Optional: Docker Desktop (for containerized run)

### Backend setup

1. Open terminal in backend folder.
2. Create and activate virtual environment.
3. Install dependencies.
4. Create local env file from example.
5. Run migrations.
6. Start API server.

Commands:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend setup

Open a second terminal:

```powershell
cd frontend
npm install
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

### Access points

- Frontend: http://localhost:3000
- Backend docs: http://localhost:8000/docs

---

## 6. Configuration

### Backend config file

- backend/.env

Common keys:

- DATABASE_URL
- SYNC_DATABASE_URL
- REDIS_URL
- JWT_SECRET
- JWT_ALGORITHM
- ADMIN_USERNAME
- ADMIN_PASSWORD
- GOOGLE_CLIENT_ID
- ENABLE_EARTH_ENGINE
- ALLOW_DEMO_SATELLITE_FALLBACK
- ALLOW_HEURISTIC_AI_FALLBACK
- REQUIRE_TRAINED_AI_MODEL
- ENABLE_INLINE_JOBS

### Frontend config file

- frontend/.env.local

Common keys:

- NEXT_PUBLIC_API_URL
- NEXT_PUBLIC_GOOGLE_CLIENT_ID

---

## 7. Runtime Modes

### Demo-safe mode (quick local continuity)

Use when Earth Engine access is not configured yet:

- ENABLE_EARTH_ENGINE=false
- ALLOW_DEMO_SATELLITE_FALLBACK=true
- ALLOW_HEURISTIC_AI_FALLBACK=true
- REQUIRE_TRAINED_AI_MODEL=false

### Full mode (real satellite + strict model requirements)

- ENABLE_EARTH_ENGINE=true
- ALLOW_DEMO_SATELLITE_FALLBACK=false
- ALLOW_HEURISTIC_AI_FALLBACK=false
- REQUIRE_TRAINED_AI_MODEL=true
- AI_MODEL_PATH=models/crop_damage_cnn.keras

---

## 8. Jobs, Workers, and Artifacts

- Analysis and reporting can run via worker queue or inline mode
- For single-service deployments, ENABLE_INLINE_JOBS=true allows background execution in API process
- Generated outputs are stored under data/artifacts

---

## 9. Testing and Quality Checks

### Backend

```powershell
cd backend
pytest
python -m py_compile app/main.py
```

### Frontend

```powershell
cd frontend
npx tsc --noEmit
```

---

## 10. Troubleshooting

### 401 on admin report download

If report download fails with unauthorized, confirm the frontend download uses authenticated API calls and that admin token exists in local storage.

### Missing database column / migration mismatch

Symptoms include runtime SQL errors for known model fields.

Fix:

```powershell
cd backend
alembic upgrade head
alembic current
```

### Earth Engine permission errors

If you see permission denied:

1. Verify project and credentials
2. Ensure required Google APIs are enabled
3. Retry after IAM propagation delay

For immediate continuity, switch to demo-safe mode.

### Frontend starts with npm run dev exit code 1

Run:

```powershell
cd frontend
npm install
npx tsc --noEmit
```

Then inspect and fix TypeScript/build errors shown in terminal output.

---

## 11. Security and Access Notes

- Admin and farmer views are role-specific
- Farmer claim access is owner-scoped
- Admin endpoints require admin role
- Never commit real .env files or secrets

---

## 12. Recommended Manual Test Flow

1. Login as farmer and submit a new claim.
2. Verify status appears in farmer requests list.
3. Trigger analysis and verify progress updates.
4. Login as admin and filter/search claims.
5. Expand a claim and review metrics/artifacts.
6. Perform single and bulk review actions.
7. Download report from admin panel.
8. Confirm audit entries appear in full claim details.

---

## 13. Additional Project Docs

- backend/README.md
- frontend/README.md
- docs/copilot.md
