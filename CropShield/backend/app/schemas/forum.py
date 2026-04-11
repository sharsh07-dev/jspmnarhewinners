from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ForumPostCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    content: str = Field(min_length=3, max_length=5000)


class ForumReplyCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class ForumPostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    author: str
    like_count: int
    created_at: datetime


class ForumPostListResponse(BaseModel):
    items: list[ForumPostResponse]


class ForumReplyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    content: str
    author: str
    created_at: datetime


class ForumReplyListResponse(BaseModel):
    items: list[ForumReplyResponse]


class ForumSearchResponse(BaseModel):
    query: str
    items: list[ForumPostResponse]
