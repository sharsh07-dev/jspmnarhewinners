from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException, status
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import create_token
from app.db.models import FarmerUser
from app.schemas.auth import AuthTokenResponse


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.settings = get_settings()

    async def login_admin(self, *, username: str, password: str) -> AuthTokenResponse:
        if username.strip() != self.settings.admin_username or password != self.settings.admin_password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials.")

        token = create_token(
            {
                "sub": username,
                "role": "admin",
                "name": username,
            },
            self.settings.jwt_secret,
            timedelta(hours=8),
        )
        return AuthTokenResponse(access_token=token)

    async def login_demo_farmer(self, *, email: str) -> AuthTokenResponse:
        """Demo login for farmers to bypass Google OAuth during evaluation/testing."""
        email = email.strip().lower()
        name = email.split("@")[0].capitalize()
        
        stmt = select(FarmerUser).where(FarmerUser.email == email)
        result = await self.session.execute(stmt)
        farmer = result.scalar_one_or_none()
        if farmer is None:
            farmer = FarmerUser(email=email, name=name)
            self.session.add(farmer)
            await self.session.flush()
            
        token = create_token(
            {
                "sub": email,
                "role": "farmer",
                "farmer_id": farmer.id,
                "name": name,
                "email": email,
            },
            self.settings.jwt_secret,
            timedelta(hours=24),
        )
        await self.session.commit()
        return AuthTokenResponse(access_token=token)

    async def login_farmer(self, *, id_token: str) -> AuthTokenResponse:
        if not self.settings.google_client_id:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Google client id is not configured.")

        try:
            google_request = GoogleRequest()
            info = google_id_token.verify_oauth2_token(
                id_token,
                google_request,
                audience=self.settings.google_client_id,
            )
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credential.") from exc
        email = str(info.get("email") or "").strip()
        name = str(info.get("name") or email or "Farmer").strip()
        picture = info.get("picture")
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google account email is required.")

        stmt = select(FarmerUser).where(FarmerUser.email == email)
        result = await self.session.execute(stmt)
        farmer = result.scalar_one_or_none()
        if farmer is None:
            farmer = FarmerUser(email=email, name=name, picture_url=picture if isinstance(picture, str) else None)
            self.session.add(farmer)
            await self.session.flush()
        else:
            farmer.name = name
            farmer.picture_url = picture if isinstance(picture, str) else None
            await self.session.flush()

        token = create_token(
            {
                "sub": email,
                "role": "farmer",
                "farmer_id": farmer.id,
                "name": name,
                "email": email,
                "picture": picture if isinstance(picture, str) else None,
            },
            self.settings.jwt_secret,
            timedelta(hours=24),
        )
        await self.session.commit()
        return AuthTokenResponse(access_token=token)