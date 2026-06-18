from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    global client, db
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db]


async def close_db() -> None:
    global client
    if client:
        client.close()


def get_db() -> AsyncIOMotorDatabase:
    if db is None:
        raise RuntimeError("Database not initialized")
    return db
