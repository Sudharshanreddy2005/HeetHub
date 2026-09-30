from datetime import datetime, timezone
from typing import Any

from pymongo.errors import DuplicateKeyError

from ..database import MongoConnection


class UserRepository:
    def __init__(self, database: MongoConnection) -> None:
        self._database = database

    @property
    def collection(self) -> Any:
        if self._database.database is None:
            raise RuntimeError("Database is not available")
        return self._database.database.users

    async def create(
        self,
        username: str,
        email: str,
        password_hash: str,
        full_name: str | None = None,
        phone: str | None = None,
    ) -> dict[str, Any]:
        user = {
            "username": username,
            "email": email,
            "full_name": full_name or username,
            "phone": phone or "",
            "password_hash": password_hash,
            "role": "participant",
            "created_at": datetime.now(timezone.utc),
        }
        try:
            result = await self.collection.insert_one(user)
        except DuplicateKeyError as error:
            raise ValueError("An account with that email or username already exists") from error
        user["_id"] = result.inserted_id
        return user

    async def find_by_email(self, email: str) -> dict[str, Any] | None:
        return await self.collection.find_one({"email": email})

    async def find_by_emails(self, emails: list[str]) -> list[dict[str, Any]]:
        normalized = [email.strip().lower() for email in emails if isinstance(email, str) and email.strip()]
        if not normalized:
            return []
        return await self.collection.find({"email": {"$in": normalized}}).to_list(length=len(normalized))

    async def find_by_id(self, user_id: str) -> dict[str, Any] | None:
        from bson import ObjectId

        try:
            object_id = ObjectId(user_id)
        except Exception:
            return None
        return await self.collection.find_one({"_id": object_id})

    async def find_by_usernames(self, usernames: list[str]) -> list[dict[str, Any]]:
        return await self.collection.find({"username": {"$in": usernames}}).to_list(length=len(usernames))

    async def find_by_ids(self, user_ids: list[Any]) -> list[dict[str, Any]]:
        return await self.collection.find({"_id": {"$in": user_ids}}).to_list(length=len(user_ids))
