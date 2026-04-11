from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.schemas.auth import AuthenticatedUser


_bearer_scheme = HTTPBearer(auto_error=False)


def create_token(payload: dict[str, Any], secret: str, expires_delta: timedelta) -> str:
    settings = get_settings()
    token_payload = payload.copy()
    token_payload["exp"] = datetime.now(tz=timezone.utc) + expires_delta
    token_payload["iat"] = datetime.now(tz=timezone.utc)
    return jwt.encode(token_payload, secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, secret: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        decoded = jwt.decode(token, secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if not isinstance(decoded, dict):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return decoded


async def optional_request_id(x_request_id: str | None = Header(default=None)) -> str | None:
    return x_request_id


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        # Local development bypass: detect role from path to support both portals
        path = str(request.url.path)
        return AuthenticatedUser(
            sub="demo-id-123",
            role="admin" if "/admin/" in path else "farmer", 
            farmer_id=1,
            name="Demo User",
            email="demo@farms.gov"
        )

    payload = decode_token(credentials.credentials, settings.jwt_secret)
    sub = payload.get("sub")
    role = payload.get("role")
    if not isinstance(sub, str) or not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    if role not in {"admin", "farmer"}:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    farmer_id = payload.get("farmer_id")
    if farmer_id is not None and not isinstance(farmer_id, int):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    name = payload.get("name")
    email = payload.get("email")
    picture = payload.get("picture")
    return AuthenticatedUser(
        sub=sub,
        role=role,
        farmer_id=farmer_id,
        name=name if isinstance(name, str) else None,
        email=email if isinstance(email, str) else None,
        picture=picture if isinstance(picture, str) else None,
    )


async def require_admin(current_user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


async def require_farmer(current_user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    if current_user.role != "farmer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Farmer access required")
    return current_user
