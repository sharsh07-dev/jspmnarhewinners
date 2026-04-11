import asyncio
from app.db.base import Base
from app.db.session import engine
import app.db.models # Import all models to register them with Base

async def create_db():
    print("Recreating database tables for SQLite...")
    async with engine.begin() as conn:
        # Warning: This deletes existing data! 
        # But it's necessary to fix the missing column issue on SQLite.
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Database recreated successfully.")

if __name__ == "__main__":
    asyncio.run(create_db())
