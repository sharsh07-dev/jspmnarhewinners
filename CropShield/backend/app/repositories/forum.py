from __future__ import annotations

from sqlalchemy import Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.forum_post import ForumPost
from app.db.models.forum_reply import ForumReply


class ForumRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_posts(self) -> list[ForumPost]:
        stmt: Select[tuple[ForumPost]] = select(ForumPost).order_by(ForumPost.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_post(self, *, title: str, content: str, author: str) -> ForumPost:
        post = ForumPost(title=title, content=content, author=author)
        self.session.add(post)
        await self.session.flush()
        return post

    async def get_post(self, post_id: int) -> ForumPost | None:
        stmt = select(ForumPost).where(ForumPost.id == post_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_replies(self, *, post_id: int) -> list[ForumReply]:
        stmt: Select[tuple[ForumReply]] = (
            select(ForumReply)
            .where(ForumReply.post_id == post_id)
            .order_by(ForumReply.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_reply(self, *, post_id: int, content: str, author: str) -> ForumReply:
        reply = ForumReply(post_id=post_id, content=content, author=author)
        self.session.add(reply)
        await self.session.flush()
        return reply

    async def increment_like(self, *, post: ForumPost) -> ForumPost:
        post.like_count = int(post.like_count) + 1
        await self.session.flush()
        return post

    async def search_posts(self, *, query: str) -> list[ForumPost]:
        pattern = f"%{query.strip()}%"
        stmt: Select[tuple[ForumPost]] = (
            select(ForumPost)
            .where(or_(ForumPost.title.ilike(pattern), ForumPost.content.ilike(pattern)))
            .order_by(ForumPost.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
