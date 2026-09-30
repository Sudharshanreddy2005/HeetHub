from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.config import Settings, get_settings
from app.main import app
from app.meetings.dependencies import get_meeting_repository


class FakeChatRepository:
    def __init__(self, host: dict[str, Any], guest: dict[str, Any]) -> None:
        self.meeting = {
            "_id": ObjectId(),
            "title": "Chat test",
            "description": "",
            "scheduled_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "duration_minutes": 30,
            "status": "LIVE",
            "host_id": host["_id"],
        }
        self.records = [
            {"user_id": host["_id"], "username": host["username"], "invitation_status": "ACCEPTED"},
            {"user_id": guest["_id"], "username": guest["username"], "invitation_status": "ACCEPTED"},
        ]
        self.messages: list[dict[str, Any]] = []
        self.events: list[dict[str, Any]] = []

    @staticmethod
    def object_id(meeting_id: str) -> ObjectId:
        return ObjectId(meeting_id)

    async def get(self, meeting_id: str) -> dict[str, Any] | None:
        return self.meeting if meeting_id == str(self.meeting["_id"]) else None

    async def participants(self, meeting_id: str) -> list[dict[str, Any]]:
        return self.records

    async def list_messages(self, meeting_id: str) -> list[dict[str, Any]]:
        return self.messages

    async def create_message(
        self, meeting_id: str, user_id: ObjectId, username: str, content: str, moderation_decision: str = "SAFE"
    ) -> dict[str, Any]:
        message = {
            "_id": ObjectId(),
            "meeting_id": self.meeting["_id"],
            "user_id": user_id,
            "username": username,
            "content": content,
            "moderation_decision": moderation_decision,
            "created_at": datetime.now(timezone.utc),
        }
        self.messages.append(message)
        return message

    async def create_moderation_event(self, event: dict[str, Any]) -> dict[str, Any]:
        event["_id"] = ObjectId()
        self.events.append(event)
        return event

    async def list_moderation_events(self, meeting_id: str) -> list[dict[str, Any]]:
        return self.events

    async def set_participant_control(self, meeting_id: str, user_id: ObjectId, changes: dict[str, Any]) -> bool:
        participant = next((item for item in self.records if item["user_id"] == user_id), None)
        if participant is None:
            return False
        participant.update(changes)
        return True


@pytest.fixture
def chat_client() -> tuple[TestClient, FakeChatRepository, dict[str, Any], dict[str, Any]]:
    host = {"_id": ObjectId(), "username": "host"}
    guest = {"_id": ObjectId(), "username": "guest"}
    repository = FakeChatRepository(host, guest)
    app.dependency_overrides[get_current_user] = lambda: guest
    app.dependency_overrides[get_meeting_repository] = lambda: repository
    app.dependency_overrides[get_settings] = lambda: Settings(
        jwt_secret="test-secret-with-at-least-32-bytes-long", chat_rate_limit_per_minute=2
    )
    with TestClient(app) as client:
        yield client, repository, host, guest
    app.dependency_overrides.clear()


def test_accepted_participant_can_send_and_read_history(chat_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, _, _ = chat_client
    async def no_broadcast(*args: object) -> None:
        return None

    monkeypatch.setattr("app.chat.router.broadcast_message", no_broadcast)

    sent = client.post(f"/meetings/{repository.meeting['_id']}/messages", json={"content": " Hello team "})
    history = client.get(f"/meetings/{repository.meeting['_id']}/messages")

    assert sent.status_code == 201
    assert sent.json()["content"] == "Hello team"
    assert history.status_code == 200
    assert history.json()[0]["username"] == "guest"


def test_pending_participant_cannot_access_chat(chat_client: tuple) -> None:
    client, repository, _, _ = chat_client
    repository.records[1]["invitation_status"] = "PENDING"

    assert client.get(f"/meetings/{repository.meeting['_id']}/messages").status_code == 403
    assert client.post(f"/meetings/{repository.meeting['_id']}/messages", json={"content": "Hello"}).status_code == 403


def test_chat_validates_empty_messages_and_rate_limits(chat_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, _, _ = chat_client
    async def no_broadcast(*args: object) -> None:
        return None

    monkeypatch.setattr("app.chat.router.broadcast_message", no_broadcast)
    url = f"/meetings/{repository.meeting['_id']}/messages"

    empty = client.post(url, json={"content": "   "})
    assert empty.status_code == 422
    assert client.post(url, json={"content": "one"}).status_code == 201
    assert client.post(url, json={"content": "two"}).status_code == 201
    assert client.post(url, json={"content": "three"}).status_code == 429


def test_chat_is_unavailable_after_meeting_ends(chat_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, _, _ = chat_client
    monkeypatch.setattr("app.chat.router.broadcast_message", lambda *args: None)
    repository.meeting["status"] = "ENDED"

    history = client.get(f"/meetings/{repository.meeting['_id']}/messages")
    send = client.post(f"/meetings/{repository.meeting['_id']}/messages", json={"content": "Hello"})

    assert history.status_code == 409
    assert send.status_code == 409


def test_chat_is_unavailable_after_meeting_is_cancelled(chat_client: tuple) -> None:
    client, repository, _, _ = chat_client
    repository.meeting["status"] = "CANCELLED"

    assert client.post(f"/meetings/{repository.meeting['_id']}/messages", json={"content": "Hello"}).status_code == 409


def test_toxic_message_is_blocked_and_recorded(chat_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, _, _ = chat_client
    async def no_broadcast(*args: object) -> None:
        return None
    monkeypatch.setattr("app.chat.router.broadcast_message", no_broadcast)

    response = client.post(f"/meetings/{repository.meeting['_id']}/messages", json={"content": "You are an idiot and stupid"})

    assert response.status_code == 422
    assert response.json()["detail"] == "Potentially abusive content detected"
    assert repository.messages == []
    assert repository.events[0]["decision"] == "BLOCK"


def test_warning_message_is_allowed_and_recorded(chat_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, _, _ = chat_client
    async def no_broadcast(*args: object) -> None:
        return None
    monkeypatch.setattr("app.chat.router.broadcast_message", no_broadcast)

    response = client.post(f"/meetings/{repository.meeting['_id']}/messages", json={"content": "That was stupid"})

    assert response.status_code == 201
    assert response.json()["moderation_decision"] == "WARNING"
    assert repository.events[0]["action"] == "allowed"
    history = client.get(f"/meetings/{repository.meeting['_id']}/messages")
    assert history.json()[0]["moderation_decision"] == "WARNING"


@pytest.mark.parametrize("content", [None, ["not", "text"], {"content": "nested"}, "x" * 2001])
def test_chat_rejects_malformed_or_overlong_content(chat_client: tuple, content: Any) -> None:
    client, repository, _, _ = chat_client

    response = client.post(f"/meetings/{repository.meeting['_id']}/messages", json={"content": content})

    assert response.status_code == 422


def test_unicode_content_is_persisted(chat_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, _, _ = chat_client
    async def no_broadcast(*args: object) -> None:
        return None
    monkeypatch.setattr("app.chat.router.broadcast_message", no_broadcast)

    response = client.post(f"/meetings/{repository.meeting['_id']}/messages", json={"content": "नमस्ते टीम 👋"})

    assert response.status_code == 201
    assert repository.messages[0]["content"] == "नमस्ते टीम 👋"


def test_only_host_can_apply_moderation_action(chat_client: tuple) -> None:
    client, repository, host, guest = chat_client
    response = client.post(
        f"/meetings/{repository.meeting['_id']}/moderation/{host['_id']}",
        json={"action": "MUTE"},
    )

    assert response.status_code == 403

    app.dependency_overrides[get_current_user] = lambda: host
    response = client.post(
        f"/meetings/{repository.meeting['_id']}/moderation/{guest['_id']}",
        json={"action": "DISABLE_CHAT"},
    )

    assert response.status_code == 200
    assert response.json()["action"] == "DISABLE_CHAT"

    app.dependency_overrides[get_current_user] = lambda: guest
    denied_chat = client.post(f"/meetings/{repository.meeting['_id']}/messages", json={"content": "Hello"})
    assert denied_chat.status_code == 403


def test_host_cannot_moderate_self(chat_client: tuple) -> None:
    client, repository, host, _ = chat_client
    app.dependency_overrides[get_current_user] = lambda: host

    response = client.post(
        f"/meetings/{repository.meeting['_id']}/moderation/{host['_id']}", json={"action": "MUTE"}
    )

    assert response.status_code == 409


def test_host_mute_and_unmute_update_persisted_control(chat_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, host, guest = chat_client
    app.dependency_overrides[get_current_user] = lambda: host
    calls: list[bool] = []

    async def microphone_control(_room: str, _identity: str, muted: bool, _settings: Settings) -> None:
        calls.append(muted)

    monkeypatch.setattr("app.moderation.router.set_microphone_muted", microphone_control)
    url = f"/meetings/{repository.meeting['_id']}/moderation/{guest['_id']}"

    muted = client.post(url, json={"action": "MUTE"})
    guest_record = next(item for item in repository.records if item["user_id"] == guest["_id"])
    unmuted = client.post(url, json={"action": "UNMUTE"})

    assert muted.status_code == 200
    assert guest_record["muted_until"] is None
    assert unmuted.status_code == 200
    assert calls == [True, False]


def test_host_remove_disconnects_and_revokes_backend_access(chat_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, host, guest = chat_client
    app.dependency_overrides[get_current_user] = lambda: host
    removed_identities: list[str] = []

    async def remove_control(_room: str, identity: str, _settings: Settings) -> None:
        removed_identities.append(identity)

    monkeypatch.setattr("app.moderation.router.remove_from_room", remove_control)
    removed = client.post(
        f"/meetings/{repository.meeting['_id']}/moderation/{guest['_id']}", json={"action": "REMOVE"}
    )
    app.dependency_overrides[get_current_user] = lambda: guest
    denied = client.get(f"/meetings/{repository.meeting['_id']}/messages")

    assert removed.status_code == 200
    assert removed_identities == [str(guest["_id"])]
    assert denied.status_code == 403


def test_blocked_participant_cannot_bypass_chat(chat_client: tuple) -> None:
    client, repository, host, guest = chat_client
    app.dependency_overrides[get_current_user] = lambda: host
    blocked = client.post(
        f"/meetings/{repository.meeting['_id']}/moderation/{guest['_id']}", json={"action": "BLOCK"}
    )
    app.dependency_overrides[get_current_user] = lambda: guest
    sent = client.post(f"/meetings/{repository.meeting['_id']}/messages", json={"content": "Hello"})

    assert blocked.status_code == 200
    assert sent.status_code == 403


def test_host_can_read_moderation_events(chat_client: tuple) -> None:
    client, repository, host, guest = chat_client
    app.dependency_overrides[get_current_user] = lambda: host
    response = client.post(
        f"/meetings/{repository.meeting['_id']}/moderation/{guest['_id']}",
        json={"action": "WARN"},
    )
    events = client.get(f"/meetings/{repository.meeting['_id']}/moderation")

    assert response.status_code == 200
    assert events.status_code == 200
    assert events.json()[0]["username"] == "guest"
