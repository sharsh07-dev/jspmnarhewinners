from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep
from app.schemas.auth import AdminLoginRequest, AuthTokenResponse, FarmerLoginRequest
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthTokenResponse, status_code=status.HTTP_200_OK)
async def login_admin(
    payload: AdminLoginRequest,
    session: AsyncSession = Depends(db_session_dep),
) -> AuthTokenResponse:
    service = AuthService(session)
    return await service.login_admin(username=payload.username, password=payload.password)


@router.post("/farmer-login", response_model=AuthTokenResponse, status_code=status.HTTP_200_OK)
async def login_farmer(
    payload: FarmerLoginRequest,
    session: AsyncSession = Depends(db_session_dep),
) -> AuthTokenResponse:
    service = AuthService(session)
    return await service.login_farmer(id_token=payload.id_token)


@router.post("/demo-farmer-login", response_model=AuthTokenResponse, status_code=status.HTTP_200_OK)
async def login_demo_farmer(
    payload: AdminLoginRequest, # Reuse AdminLoginRequest for simplicity as it has email/username
    session: AsyncSession = Depends(db_session_dep),
) -> AuthTokenResponse:
    service = AuthService(session)
    return await service.login_demo_farmer(email=payload.username)