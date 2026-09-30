import hashlib
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from ..database import MongoConnection


class MeetingRepository:
    def __init__(self, database: MongoConnection) -> None:
        self._database = database

    @property
    def db(self) -> Any:
        if self._database.database is None:
            raise RuntimeError("Database is not available")
        return self._database.database

    @staticmethod
    def object_id(meeting_id: str) -> ObjectId | None:
        try:
            return ObjectId(meeting_id)
        except Exception:
            return None

    async def create(self, meeting: dict[str, Any], participants: list[dict[str, Any]]) -> dict[str, Any]:
        result = await self.db.meetings.insert_one(meeting)
        for participant in participants:
            participant["meeting_id"] = result.inserted_id
        try:
            await self.db.meeting_participants.insert_many(participants)
        except DuplicateKeyError as error:
            await self.db.meetings.delete_one({"_id": result.inserted_id})
            raise ValueError("Duplicate meeting participant") from error
        meeting["_id"] = result.inserted_id
        return meeting

    async def get(self, meeting_id: str) -> dict[str, Any] | None:
        object_id = self.object_id(meeting_id)
        return await self.db.meetings.find_one({"_id": object_id}) if object_id else None

    async def find_by_code(self, meeting_code: str) -> dict[str, Any] | None:
        normalized = meeting_code.strip().upper()
        return await self.db.meetings.find_one({"meeting_code": normalized})

    async def find_by_invitation_token(self, token: str) -> dict[str, Any] | None:
        normalized = (token or "").strip()
        if not normalized:
            return None
        digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        return await self.db.meetings.find_one({"invitation_token_hash": digest})

    async def participants(self, meeting_id: str) -> list[dict[str, Any]]:
        object_id = self.object_id(meeting_id)
        if object_id is None:
            return []
        return await self.db.meeting_participants.find({"meeting_id": object_id}).to_list(length=1000)

    async def all_focus_metrics(self, meeting_id: str) -> list[dict[str, Any]]:
        object_id = self.object_id(meeting_id)
        if object_id is None:
            return []
        return await self.db.focus_events.find({"meeting_id": object_id}).to_list(length=1000)

    async def find_for_user(self, user_id: ObjectId, upcoming: bool | None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {"$or": [{"host_id": user_id}, {"user_id": user_id}]}
        participant_ids = await self.db.meeting_participants.find(
            {"user_id": user_id, "invitation_status": "ACCEPTED"}, {"meeting_id": 1}
        ).to_list(length=1000)
        query = {"$or": [{"host_id": user_id}, {"_id": {"$in": [item["meeting_id"] for item in participant_ids]}}]}
        if upcoming is True:
            query["scheduled_at"] = {"$gte": datetime.now(timezone.utc)}
        elif upcoming is False:
            query["scheduled_at"] = {"$lt": datetime.now(timezone.utc)}
        return await self.db.meetings.find(query).sort("scheduled_at", 1).to_list(length=1000)

    async def update(self, meeting_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        object_id = self.object_id(meeting_id)
        if object_id is None:
            return None
        return await self.db.meetings.find_one_and_update(
            {"_id": object_id}, {"$set": changes}, return_document=ReturnDocument.AFTER
        )

    @staticmethod
    def meeting_controls(meeting: dict[str, Any]) -> dict[str, bool]:
        defaults = {
            "allow_chat": True,
            "allow_participant_microphone": True,
            "allow_participant_camera": True,
            "allow_screen_share": True,
            "allow_reactions": True,
            "allow_raise_hand": True,
            "meeting_locked": False,
            "waiting_room_enabled": False,
            "join_before_host": True,
        }
        stored = meeting.get("controls")
        if isinstance(stored, dict):
            for key in defaults:
                if isinstance(stored.get(key), bool):
                    defaults[key] = stored[key]
        return defaults

    async def update_meeting_controls(self, meeting_id: str, changes: dict[str, bool]) -> dict[str, Any] | None:
        object_id = self.object_id(meeting_id)
        if object_id is None:
            return None
        set_values = {f"controls.{key}": value for key, value in changes.items()}
        set_values["updated_at"] = datetime.now(timezone.utc)
        return await self.db.meetings.find_one_and_update(
            {"_id": object_id}, {"$set": set_values}, return_document=ReturnDocument.AFTER
        )

    async def cancel(self, meeting_id: str) -> dict[str, Any] | None:
        return await self.update(meeting_id, {"status": "CANCELLED", "updated_at": datetime.now(timezone.utc)})

    async def get_invitation(self, invitation_id: str) -> dict[str, Any] | None:
        object_id = self.object_id(invitation_id)
        return await self.db.meeting_participants.find_one({"_id": object_id}) if object_id else None

    async def update_invitation(self, invitation_id: str, status: str) -> dict[str, Any] | None:
        object_id = self.object_id(invitation_id)
        if object_id is None:
            return None
        return await self.db.meeting_participants.find_one_and_update(
            {"_id": object_id}, {"$set": {"invitation_status": status, "updated_at": datetime.now(timezone.utc)}}, return_document=ReturnDocument.AFTER
        )

    async def mark_joined(self, meeting_id: str, user_id: ObjectId) -> None:
        object_id = self.object_id(meeting_id)
        if object_id is not None:
            await self.db.meeting_participants.update_one(
                {"meeting_id": object_id, "user_id": user_id},
                {"$set": {"joined_at": datetime.now(timezone.utc), "left_at": None}},
            )

    async def mark_left(self, meeting_id: str, user_id: ObjectId) -> None:
        object_id = self.object_id(meeting_id)
        if object_id is not None:
            await self.db.meeting_participants.update_one(
                {"meeting_id": object_id, "user_id": user_id},
                {"$set": {"left_at": datetime.now(timezone.utc)}},
            )

    async def invitations_for_user(self, user_id: ObjectId) -> list[dict[str, Any]]:
        return await self.db.meeting_participants.find({"user_id": user_id}).sort("created_at", -1).to_list(length=1000)

    async def create_notification(self, user_id: ObjectId, meeting_id: ObjectId) -> None:
        await self.db.notifications.insert_one(
            {"user_id": user_id, "meeting_id": meeting_id, "type": "MEETING_INVITATION", "read": False, "created_at": datetime.now(timezone.utc)}
        )

    async def list_messages(self, meeting_id: str, limit: int = 100) -> list[dict[str, Any]]:
        object_id = self.object_id(meeting_id)
        if object_id is None:
            return []
        return await self.db.messages.find({"meeting_id": object_id}).sort("created_at", 1).limit(limit).to_list(length=limit)

    async def create_message(
        self, meeting_id: str, user_id: ObjectId, username: str, content: str, moderation_decision: str = "SAFE"
    ) -> dict[str, Any]:
        object_id = self.object_id(meeting_id)
        if object_id is None:
            raise ValueError("Invalid meeting ID")
        message = {
            "meeting_id": object_id,
            "user_id": user_id,
            "username": username,
            "content": content,
            "moderation_decision": moderation_decision,
            "created_at": datetime.now(timezone.utc),
        }
        result = await self.db.messages.insert_one(message)
        message["_id"] = result.inserted_id
        return message

    async def set_participant_control(self, meeting_id: str, user_id: ObjectId, changes: dict[str, Any]) -> bool:
        object_id = self.object_id(meeting_id)
        if object_id is None:
            return False
        result = await self.db.meeting_participants.update_one(
            {"meeting_id": object_id, "user_id": user_id}, {"$set": changes}
        )
        return result.matched_count == 1

    async def create_moderation_event(self, event: dict[str, Any]) -> dict[str, Any]:
        result = await self.db.moderation_events.insert_one(event)
        event["_id"] = result.inserted_id
        return event

    async def list_moderation_events(self, meeting_id: str, limit: int = 100) -> list[dict[str, Any]]:
        object_id = self.object_id(meeting_id)
        if object_id is None:
            return []
        return await self.db.moderation_events.find({"meeting_id": object_id}).sort("created_at", -1).limit(limit).to_list(length=limit)

    async def upsert_focus_metric(self, meeting_id: str, user_id: ObjectId, metric: dict[str, Any]) -> None:
        object_id = self.object_id(meeting_id)
        if object_id is None:
            raise ValueError("Invalid meeting ID")
        await self.db.focus_events.replace_one(
            {"meeting_id": object_id, "user_id": user_id},
            {"meeting_id": object_id, "user_id": user_id, **metric},
            upsert=True,
        )

    async def latest_focus_metrics(self, meeting_id: str, since: datetime) -> list[dict[str, Any]]:
        object_id = self.object_id(meeting_id)
        if object_id is None:
            return []
        return await self.db.focus_events.find(
            {"meeting_id": object_id, "updated_at": {"$gte": since}, "status": {"$ne": "UNAVAILABLE"}}
        ).to_list(length=1000)
