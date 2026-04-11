from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.admin import router as admin_router
from app.api.v1.routes.claims import router as claims_router
from app.api.v1.routes.dashboard import router as dashboard_router
from app.api.v1.routes.farms import router as farms_router
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.jobs import router as jobs_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(health_router)
api_router.include_router(farms_router)
api_router.include_router(claims_router)
api_router.include_router(jobs_router)
api_router.include_router(dashboard_router)
api_router.include_router(admin_router)
