from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.config import Settings, get_settings
from app.main import app
from app.meetings.dependencies import get_meeting_repository
from app.meetings.models import InvitationStatus, MeetingStatus


class FakeVideoRepository:
    def __init__(self, host: dict[str, Any], guest: dict[str, Any]) -> None:
        self.meeting = {
            "_id": ObjectId(),
            "title": "Video test",
            "description": "",
            "scheduled_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "duration_minutes": 30,
            "status": MeetingStatus.SCHEDULED,
            "host_id": host["_id"],
            "host_username": host["username"],
        }
        self.records = [
            {"_id": ObjectId(), "meeting_id": self.meeting["_id"], "user_id": host["_id"], "username": host["username"], "role": "host", "invitation_status": InvitationStatus.ACCEPTED},
            {"_id": ObjectId(), "meeting_id": self.meeting["_id"], "user_id": guest["_id"], "username": guest["username"], "role": "participant", "invitation_status": InvitationStatus.PENDING},
        ]

    async def get(self, meeting_id: str) -> dict[str, Any] | None:
        return self.meeting if meeting_id == str(self.meeting["_id"]) else None

    async def participants(self, meeting_id: str) -> list[dict[str, Any]]:
        return self.records

    async def update(self, meeting_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        self.meeting.update(changes)
        return self.meeting

    async def mark_joined(self, meeting_id: str, user_id: ObjectId) -> None:
        next(record for record in self.records if record["user_id"] == user_id)["joined_at"] = datetime.now(timezone.utc)

    async def mark_left(self, meeting_id: str, user_id: ObjectId) -> None:
        next(record for record in self.records if record["user_id"] == user_id)["left_at"] = datetime.now(timezone.utc)


@pytest.fixture
def video_client(monkeypatch: pytest.MonkeyPatch) -> tuple[TestClient, FakeVideoRepository, dict[str, Any], dict[str, Any]]:
    host = {"_id": ObjectId(), "username": "host"}
    guest = {"_id": ObjectId(), "username": "guest"}
    repository = FakeVideoRepository(host, guest)
    app.dependency_overrides[get_current_user] = lambda: host
    app.dependency_overrides[get_meeting_repository] = lambda: repository
    app.dependency_overrides[get_settings] = lambda: Settings(
        jwt_secret="test-secret-with-at-least-32-bytes-long",
        livekit_api_key="key",
        livekit_api_secret="secret",
        livekit_url="wss://livekit.example.com",
    )
    with TestClient(app) as client:
        yield client, repository, host, guest
    app.dependency_overrides.clear()


def test_host_can_join_and_receive_server_token(video_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, host, _ = video_client
    monkeypatch.setattr("app.meetings.router.create_meeting_token", lambda *args: ("server-token", "meeting-room"))

    response = client.post(f"/meetings/{repository.meeting['_id']}/join")

    assert response.status_code == 200
    assert response.json()["token"] == "server-token"
    assert response.json()["room_name"] == "meeting-room"
    assert repository.meeting["status"] == MeetingStatus.LIVE


def test_pending_participant_cannot_join(video_client: tuple) -> None:
    client, repository, _, guest = video_client
    app.dependency_overrides[get_current_user] = lambda: guest

    response = client.post(f"/meetings/{repository.meeting['_id']}/join")

    assert response.status_code == 403


def test_accepted_participant_can_join(video_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, _, guest = video_client
    repository.records[1]["invitation_status"] = InvitationStatus.ACCEPTED
    app.dependency_overrides[get_current_user] = lambda: guest
    monkeypatch.setattr("app.meetings.router.create_meeting_token", lambda *args: ("guest-token", "meeting-room"))

    response = client.post(f"/meetings/{repository.meeting['_id']}/join")

    assert response.status_code == 200
    assert response.json()["token"] == "guest-token"


def test_unconfigured_livekit_returns_service_unavailable(video_client: tuple) -> None:
    client, repository, _, _ = video_client
    app.dependency_overrides[get_settings] = lambda: Settings(
        jwt_secret="test-secret-with-at-least-32-bytes-long",
        livekit_api_key="",
        livekit_api_secret="",
        livekit_url="",
    )

    response = client.post(f"/meetings/{repository.meeting['_id']}/join")

    assert response.status_code == 503


def test_leave_records_departure(video_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, host, _ = video_client
    monkeypatch.setattr("app.meetings.router.create_meeting_token", lambda *args: ("server-token", "meeting-room"))
    client.post(f"/meetings/{repository.meeting['_id']}/join")

    response = client.post(f"/meetings/{repository.meeting['_id']}/leave")

    assert response.status_code == 204
    assert any(record.get("left_at") for record in repository.records if record["user_id"] == host["_id"])


def test_end_meeting_disconnects_active_participants_and_closes_attendance(
    video_client: tuple, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, repository, host, guest = video_client
    now = datetime.now(timezone.utc)
    repository.records[0]["joined_at"] = now
    repository.records[1]["invitation_status"] = InvitationStatus.ACCEPTED
    repository.records[1]["joined_at"] = now
    removed: list[str] = []

    async def remove_from_room(_room_name: str, identity: str, _settings: Settings) -> None:
        removed.append(identity)

    monkeypatch.setattr("app.meetings.router.remove_from_room", remove_from_room, raising=False)

    response = client.post(f"/meetings/{repository.meeting['_id']}/end")

    assert response.status_code == 200
    assert response.json()["status"] == MeetingStatus.ENDED
    assert removed == [str(guest["_id"])]
    assert all(record.get("left_at") is not None for record in repository.records)


def test_only_host_can_end_and_ended_meeting_cannot_be_joined(video_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, _, guest = video_client
    repository.records[1]["invitation_status"] = InvitationStatus.ACCEPTED
    app.dependency_overrides[get_current_user] = lambda: guest
    monkeypatch.setattr("app.meetings.router.create_meeting_token", lambda *args: ("guest-token", "meeting-room"))
    client.post(f"/meetings/{repository.meeting['_id']}/join")

    forbidden = client.post(f"/meetings/{repository.meeting['_id']}/end")
    app.dependency_overrides[get_current_user] = lambda: {"_id": repository.meeting["host_id"], "username": "host"}
    ended = client.post(f"/meetings/{repository.meeting['_id']}/end")
    blocked = client.post(f"/meetings/{repository.meeting['_id']}/join")

    assert forbidden.status_code == 403
    assert ended.status_code == 200
    assert ended.json()["status"] == "ENDED"
    assert blocked.status_code == 409
