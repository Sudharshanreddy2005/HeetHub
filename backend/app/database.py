import logging
from collections.abc import AsyncIterator

from motor.motor_asyncio import AsyncIOMotorClient

from .config import Settings

logger = logging.getLogger(__name__)


class MongoConnection:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self.client: AsyncIOMotorClient | None = None
        self.is_available = False

    async def connect(self) -> None:
        if not self._settings.mongodb_uri:
            logger.info("MongoDB is not configured; continuing without database connectivity")
            return

        self.client = AsyncIOMotorClient(self._settings.mongodb_uri, serverSelectionTimeoutMS=1000)
        try:
            await self.client.admin.command("ping")
        except Exception:
            logger.warning("MongoDB is configured but unavailable; health endpoint remains available")
            await self.close()
        else:
            self.is_available = True
            await self.database.users.create_index("email", unique=True)
            await self.database.users.create_index("username", unique=True)
            await self.database.meetings.create_index("host_id")
            await self.database.meetings.create_index("scheduled_at")
            await self.database.meeting_participants.create_index(
                [("meeting_id", 1), ("user_id", 1)], unique=True
            )
            await self.database.meeting_participants.create_index([("user_id", 1), ("invitation_status", 1)])
            await self.database.notifications.create_index([("user_id", 1), ("created_at", -1)])
            await self.database.messages.create_index([("meeting_id", 1), ("created_at", 1)])
            await self.database.moderation_events.create_index([("meeting_id", 1), ("created_at", -1)])
            await self.database.focus_events.create_index([("meeting_id", 1), ("user_id", 1)], unique=True)
            await self.database.focus_events.create_index([("meeting_id", 1), ("updated_at", -1)])
            logger.info("MongoDB connection established")

    @property
    def database(self):
        if self.client is None:
            return None
        return self.client[self._settings.mongodb_database]

    async def close(self) -> None:
        if self.client is not None:
            self.client.close()
        self.client = None
        self.is_available = False

    async def lifespan(self) -> AsyncIterator[None]:
        await self.connect()
        try:
            yield
        finally:
            await self.close()
