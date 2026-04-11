from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.forum import ForumRepository


class ForumServiceAdapter:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ForumRepository(session)

    async def list_posts(self) -> dict[str, object]:
        posts = await self.repo.list_posts()
        return {"items": posts}

    async def create_post(self, *, title: str, content: str, author: str) -> dict[str, object]:
        post = await self.repo.create_post(title=title, content=content, author=author)
        await self.session.commit()
        await self.session.refresh(post)
        return post

    async def list_replies(self, *, post_id: int) -> dict[str, object]:
        replies = await self.repo.list_replies(post_id=post_id)
        return {"items": replies}

    async def create_reply(self, *, post_id: int, content: str, author: str) -> dict[str, object]:
        post = await self.repo.get_post(post_id)
        if post is None:
            raise ValueError("Forum post not found")
        reply = await self.repo.create_reply(post_id=post_id, content=content, author=author)
        await self.session.commit()
        await self.session.refresh(reply)
        return reply

    async def like_post(self, *, post_id: int) -> dict[str, object] | None:
        post = await self.repo.get_post(post_id)
        if post is None:
            return None
        updated_post = await self.repo.increment_like(post=post)
        await self.session.commit()
        await self.session.refresh(updated_post)
        return updated_post

    async def search_posts(self, *, query: str) -> dict[str, object]:
        if not query.strip():
            return {"query": query, "items": []}
        matches = await self.repo.search_posts(query=query)
        return {"query": query, "items": matches}
