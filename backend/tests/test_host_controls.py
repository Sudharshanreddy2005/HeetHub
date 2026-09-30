from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.config import Settings, get_settings
from app.main import app
from app.meetings.dependencies import get_meeting_repository


class ControlRepository:
    def __init__(self, host: dict[str, Any], guest: dict[str, Any]) -> None:
        self.meeting = {
            "_id": ObjectId(),
            "status": "LIVE",
            "host_id": host["_id"],
            "host_username": host["username"],
            "controls": {"allow_chat": True, "allow_participant_microphone": True, "allow_participant_camera": True, "allow_screen_share": True},
        }
        self.records = [
            {"user_id": host["_id"], "username": host["username"], "role": "host", "invitation_status": "ACCEPTED"},
            {"user_id": guest["_id"], "username": guest["username"], "role": "participant", "invitation_status": "ACCEPTED"},
        ]

    @staticmethod
    def object_id(value: str) -> ObjectId:
        return ObjectId(value)

    @staticmethod
    def meeting_controls(meeting: dict[str, Any]) -> dict[str, bool]:
        defaults = {"allow_chat": True, "allow_participant_microphone": True, "allow_participant_camera": True, "allow_screen_share": True, "allow_reactions": True, "allow_raise_hand": True, "meeting_locked": False, "waiting_room_enabled": False, "join_before_host": True}
        defaults.update({key: value for key, value in meeting.get("controls", {}).items() if key in defaults and isinstance(value, bool)})
        return defaults

    async def get(self, meeting_id: str) -> dict[str, Any] | None:
        return self.meeting if meeting_id == str(self.meeting["_id"]) else None

    async def participants(self, meeting_id: str) -> list[dict[str, Any]]:
        return self.records

    async def update_meeting_controls(self, meeting_id: str, changes: dict[str, bool]) -> dict[str, Any]:
        self.meeting.setdefault("controls", {}).update(changes)
        return self.meeting

    async def set_participant_control(self, meeting_id: str, user_id: ObjectId, changes: dict[str, Any]) -> bool:
        participant = next(item for item in self.records if item["user_id"] == user_id)
        participant.update(changes)
        return True


def client_fixture() -> tuple[TestClient, ControlRepository, dict[str, Any], dict[str, Any]]:
    host = {"_id": ObjectId(), "username": "host"}
    guest = {"_id": ObjectId(), "username": "guest"}
    repository = ControlRepository(host, guest)
    app.dependency_overrides[get_current_user] = lambda: host
    app.dependency_overrides[get_meeting_repository] = lambda: repository
    app.dependency_overrides[get_settings] = lambda: Settings(jwt_secret="test-secret-with-at-least-32-bytes-long")
    return TestClient(app), repository, host, guest


def test_only_host_can_update_meeting_controls() -> None:
    client, repository, _, guest = client_fixture()
    try:
        response = client.patch(f"/meetings/{repository.meeting['_id']}/controls", json={"allow_chat": False})
        assert response.status_code == 200
        assert response.json()["allow_chat"] is False
        app.dependency_overrides[get_current_user] = lambda: guest
        denied = client.patch(f"/meetings/{repository.meeting['_id']}/controls", json={"allow_chat": True})
        assert denied.status_code == 403
    finally:
        client.close()
        app.dependency_overrides.clear()


def test_host_can_restrict_participant_and_state_is_returned() -> None:
    client, repository, _, guest = client_fixture()
    try:
        response = client.patch(
            f"/meetings/{repository.meeting['_id']}/participants/{guest['_id']}/controls",
            json={"chat_allowed": False, "camera_allowed": False, "screen_share_allowed": False},
        )
        assert response.status_code == 200
        assert response.json()["chat_allowed"] is False
        assert response.json()["camera_allowed"] is False
        assert response.json()["screen_share_allowed"] is False
    finally:
        client.close()
        app.dependency_overrides.clear()


def test_locked_meeting_rejects_participant_join() -> None:
    client, repository, _, guest = client_fixture()
    try:
        repository.meeting["controls"]["meeting_locked"] = True
        repository.records[1]["invitation_status"] = "ACCEPTED"
        app.dependency_overrides[get_current_user] = lambda: guest
        response = client.post(f"/meetings/{repository.meeting['_id']}/join")
        assert response.status_code == 403
    finally:
        client.close()
        app.dependency_overrides.clear()
