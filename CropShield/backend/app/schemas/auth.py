from __future__ import annotations

from pydantic import BaseModel, Field


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=255)


class FarmerLoginRequest(BaseModel):
    id_token: str = Field(min_length=1)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthenticatedUser(BaseModel):
    sub: str
    role: str
    farmer_id: int | None = None
    name: str | None = None
    email: str | None = None
    picture: str | None = None