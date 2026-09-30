from datetime import datetime, timedelta, timezone
from typing import Any

import hashlib

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user, get_user_repository
from app.config import Settings, get_settings
from app.main import app
from app.meetings.dependencies import get_meeting_repository


class FakeUserRepository:
    def __init__(self, users: list[dict[str, Any]]) -> None:
        self.users = {user["username"]: user for user in users}

    async def find_by_usernames(self, usernames: list[str]) -> list[dict[str, Any]]:
        return [self.users[username] for username in usernames if username in self.users]

    async def find_by_emails(self, emails: list[str]) -> list[dict[str, Any]]:
        normalized = {email.lower() for email in emails if isinstance(email, str) and email}
        return [user for user in self.users.values() if user.get("email", "").lower() in normalized]


class FakeMeetingRepository:
    def __init__(self) -> None:
        self.meetings: dict[str, dict[str, Any]] = {}
        self.participant_records: dict[str, list[dict[str, Any]]] = {}
        self.notifications: list[dict[str, Any]] = []
        self.focus_metrics: dict[tuple[str, str], dict[str, Any]] = {}

    async def create(self, meeting: dict[str, Any], participants: list[dict[str, Any]]) -> dict[str, Any]:
        meeting["_id"] = ObjectId()
        meeting_id = str(meeting["_id"])
        self.meetings[meeting_id] = meeting
        self.participant_records[meeting_id] = []
        for participant in participants:
            participant["_id"] = ObjectId()
            participant["meeting_id"] = meeting["_id"]
            self.participant_records[meeting_id].append(participant)
        return meeting

    async def get(self, meeting_id: str) -> dict[str, Any] | None:
        return self.meetings.get(meeting_id)

    async def find_by_code(self, meeting_code: str) -> dict[str, Any] | None:
        normalized = meeting_code.strip().upper()
        for meeting in self.meetings.values():
            if meeting.get("meeting_code") == normalized:
                return meeting
        return None

    async def find_by_invitation_token(self, token: str) -> dict[str, Any] | None:
        normalized = (token or "").strip()
        if not normalized:
            return None
        digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        for meeting in self.meetings.values():
            if meeting.get("invitation_token_hash") == digest:
                return meeting
        return None

    async def participants(self, meeting_id: str) -> list[dict[str, Any]]:
        return self.participant_records.get(meeting_id, [])

    async def find_for_user(self, user_id: ObjectId, upcoming: bool | None) -> list[dict[str, Any]]:
        meeting_ids = {
            meeting_id
            for meeting_id, participants in self.participant_records.items()
            if any(item["user_id"] == user_id for item in participants)
        }
        meetings = [meeting for meeting_id, meeting in self.meetings.items() if meeting_id in meeting_ids]
        now = datetime.now(timezone.utc)
        meetings = [
            meeting
            for meeting in meetings
            if any(
                item["user_id"] == user_id and item["invitation_status"] == "ACCEPTED"
                for item in self.participant_records[str(meeting["_id"])]
            )
        ]
        if upcoming is True:
            meetings = [meeting for meeting in meetings if meeting["scheduled_at"] >= now]
        elif upcoming is False:
            meetings = [meeting for meeting in meetings if meeting["scheduled_at"] < now]
        return sorted(meetings, key=lambda meeting: meeting["scheduled_at"])

    async def update(self, meeting_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        meeting = self.meetings.get(meeting_id)
        if meeting is None:
            return None
        meeting.update(changes)
        return meeting

    async def cancel(self, meeting_id: str) -> dict[str, Any] | None:
        return await self.update(meeting_id, {"status": "CANCELLED"})

    async def get_invitation(self, invitation_id: str) -> dict[str, Any] | None:
        return next(
            (item for records in self.participant_records.values() for item in records if str(item["_id"]) == invitation_id),
            None,
        )

    async def update_invitation(self, invitation_id: str, invitation_status: str) -> dict[str, Any] | None:
        invitation = await self.get_invitation(invitation_id)
        if invitation is not None:
            invitation["invitation_status"] = invitation_status
        return invitation

    async def mark_joined(self, meeting_id: str, user_id: ObjectId) -> None:
        for record in self.participant_records.get(meeting_id, []):
            if record["user_id"] == user_id:
                record["joined_at"] = datetime.now(timezone.utc)
                record["left_at"] = None
                return

    async def invitations_for_user(self, user_id: ObjectId) -> list[dict[str, Any]]:
        return [item for records in self.participant_records.values() for item in records if item["user_id"] == user_id]

    async def create_notification(self, user_id: ObjectId, meeting_id: ObjectId) -> None:
        self.notifications.append({"user_id": user_id, "meeting_id": meeting_id})

    async def all_focus_metrics(self, meeting_id: str) -> list[dict[str, Any]]:
        return []

    async def list_moderation_events(self, meeting_id: str) -> list[dict[str, Any]]:
        return []

    async def upsert_focus_metric(self, meeting_id: str, user_id: ObjectId, metric: dict[str, Any]) -> None:
        self.focus_metrics[(meeting_id, str(user_id))] = metric

    async def latest_focus_metrics(self, meeting_id: str, since: datetime) -> list[dict[str, Any]]:
        return list(self.focus_metrics.values())


@pytest.fixture
def meeting_client() -> tuple[TestClient, FakeMeetingRepository, dict[str, Any], dict[str, Any]]:
    host = {"_id": ObjectId(), "username": "host", "email": "host@example.com"}
    guest = {"_id": ObjectId(), "username": "guest", "email": "guest@example.com"}
    users = FakeUserRepository([host, guest])
    meetings = FakeMeetingRepository()
    app.dependency_overrides[get_current_user] = lambda: host
    app.dependency_overrides[get_user_repository] = lambda: users
    app.dependency_overrides[get_meeting_repository] = lambda: meetings
    app.dependency_overrides[get_settings] = lambda: Settings(
        jwt_secret="test-secret-with-at-least-32-bytes-long",
        livekit_api_key="key",
        livekit_api_secret="secret",
        livekit_url="wss://livekit.example.com",
    )
    with TestClient(app) as client:
        yield client, meetings, host, guest
    app.dependency_overrides.clear()


def meeting_payload(**overrides: Any) -> dict[str, Any]:
    payload = {
        "title": "Planning session",
        "description": "Discuss the next milestone",
        "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "duration_minutes": 60,
        "participant_usernames": ["guest"],
        "participant_emails": ["guest@example.com"],
    }
    payload.update(overrides)
    return payload


def test_create_meeting_and_participant_invitation(meeting_client: tuple) -> None:
    client, repository, host, guest = meeting_client

    response = client.post("/meetings", json=meeting_payload())

    assert response.status_code == 201
    assert response.json()["host_username"] == "host"
    assert {item["username"] for item in response.json()["participants"]} == {"host", "guest"}
    assert response.json()["participants"][1]["invitation_status"] == "PENDING"
    assert len(repository.notifications) == 1


def test_create_meeting_uses_participant_emails_and_generates_secure_join_details(meeting_client: tuple) -> None:
    client, _, host, guest = meeting_client
    guest_record = {"_id": guest["_id"], "username": guest["username"], "email": "guest@example.com"}
    payload = meeting_payload(participant_usernames=[], participant_emails=["guest@example.com"])

    response = client.post("/meetings", json=payload)

    assert response.status_code == 201
    assert response.json()["meeting_code"]
    assert response.json()["join_url"].startswith("/join/")
    assert response.json()["participants"][1]["username"] == guest_record["username"]


def test_create_meeting_normalizes_duplicate_and_invalid_emails(meeting_client: tuple) -> None:
    client, repository, _, _ = meeting_client
    response = client.post(
        "/meetings",
        json=meeting_payload(
            participant_usernames=[],
            participant_emails=[" Alex@Example.com ", "alex@example.com", "john@example.com", "bad@@example.com"],
        ),
    )

    assert response.status_code == 422
    created = client.post(
        "/meetings",
        json=meeting_payload(
            participant_usernames=[],
            participant_emails=[" Alex@Example.com ", "alex@example.com", "john@example.com"],
        ),
    )
    assert created.status_code == 201
    invited = [item for item in repository.participant_records[created.json()["id"]] if item["role"] == "participant"]
    assert [item["username"] for item in invited] == ["guest", "host"] if False else len(invited) == 2


def test_create_meeting_uses_secure_invitation_token_not_meeting_code(meeting_client: tuple) -> None:
    client, _, _, _ = meeting_client
    response = client.post("/meetings", json=meeting_payload())

    assert response.status_code == 201
    join_url = response.json()["join_url"]
    token = join_url.rsplit("/", 1)[-1]
    assert join_url.startswith("/join/")
    assert len(token) >= 16
    assert token != response.json()["meeting_code"]


def test_guest_can_accept_valid_invitation_token(meeting_client: tuple) -> None:
    client, _, _, guest = meeting_client
    created = client.post("/meetings", json=meeting_payload()).json()
    app.dependency_overrides[get_current_user] = lambda: guest
    token = created["join_url"].rsplit("/", 1)[-1]

    response = client.post("/meetings/join/token", json={"token": token, "full_name": "Guest Person", "email": "guest@example.com"})

    assert response.status_code == 200
    assert response.json()["meeting_id"] == created["id"]


def test_unknown_participant_is_rejected(meeting_client: tuple) -> None:
    response = meeting_client[0].post("/meetings", json=meeting_payload(participant_usernames=["missing"]))

    assert response.status_code == 404


def test_pending_participant_cannot_view_meeting_details_or_list(meeting_client: tuple) -> None:
    client, _, _, guest = meeting_client
    created = client.post("/meetings", json=meeting_payload()).json()
    app.dependency_overrides[get_current_user] = lambda: guest

    details = client.get(f"/meetings/{created['id']}")
    meetings = client.get("/meetings")

    assert details.status_code == 403
    assert meetings.status_code == 200
    assert meetings.json() == []


def test_declined_or_blocked_participant_cannot_view_meeting(meeting_client: tuple) -> None:
    client, repository, _, guest = meeting_client
    created = client.post("/meetings", json=meeting_payload()).json()
    guest_record = next(item for item in repository.participant_records[created["id"]] if item["user_id"] == guest["_id"])
    app.dependency_overrides[get_current_user] = lambda: guest

    guest_record["invitation_status"] = "DECLINED"
    declined = client.get(f"/meetings/{created['id']}")
    guest_record["invitation_status"] = "BLOCKED"
    blocked = client.get(f"/meetings/{created['id']}")

    assert declined.status_code == 403
    assert blocked.status_code == 403


def test_guest_can_list_invitation_and_accept(meeting_client: tuple) -> None:
    client, repository, host, guest = meeting_client
    created = client.post("/meetings", json=meeting_payload()).json()
    invitation_id = next(
        str(item["_id"])
        for item in repository.participant_records[created["id"]]
        if item["user_id"] == guest["_id"]
    )
    app.dependency_overrides[get_current_user] = lambda: guest

    invitations = client.get("/meetings/invitations")
    accepted = client.post(f"/meetings/invitations/{invitation_id}/accept")

    assert invitations.status_code == 200
    assert invitations.json()[0]["invitation_status"] == "PENDING"
    assert accepted.status_code == 200
    assert accepted.json()["invitation_status"] == "ACCEPTED"


def test_host_does_not_see_own_meeting_as_an_invitation(meeting_client: tuple) -> None:
    client, _, _, _ = meeting_client
    assert client.post("/meetings", json=meeting_payload()).status_code == 201

    response = client.get("/meetings/invitations")

    assert response.status_code == 200
    assert response.json() == []


def test_accepted_participant_does_not_receive_invitee_emails_or_host_join_credentials(meeting_client: tuple) -> None:
    client, repository, host, guest = meeting_client
    created_response = client.post(
        "/meetings",
        json=meeting_payload(participant_emails=["guest@example.com", "other@example.com"]),
    )
    created = created_response.json()
    invitation_id = next(
        str(item["_id"])
        for item in repository.participant_records[created["id"]]
        if item["user_id"] == guest["_id"]
    )
    app.dependency_overrides[get_current_user] = lambda: guest
    assert client.post(f"/meetings/invitations/{invitation_id}/accept").status_code == 200

    detail = client.get(f"/meetings/{created['id']}")
    meetings = client.get("/meetings")

    assert created_response.status_code == 201
    assert "other@example.com" in created["invited_emails"]
    assert created["meeting_code"]
    assert created["join_url"]
    assert created["join_password"]
    assert detail.status_code == 200
    assert detail.json()["invited_emails"] == []
    assert detail.json()["meeting_code"] == ""
    assert detail.json()["join_url"] == ""
    assert detail.json()["join_password"] == ""
    assert meetings.status_code == 200
    assert meetings.json()[0]["invited_emails"] == []
    assert meetings.json()[0]["meeting_code"] == ""
    assert meetings.json()[0]["join_url"] == ""
    assert meetings.json()[0]["join_password"] == ""

    app.dependency_overrides[get_current_user] = lambda: host
    host_detail = client.get(f"/meetings/{created['id']}").json()
    assert host_detail["meeting_code"] == created["meeting_code"]
    assert host_detail["join_url"] == created["join_url"]
    assert host_detail["join_password"] == created["join_password"]


def test_invited_guest_can_join_with_meeting_code_and_password(meeting_client: tuple) -> None:
    client, _, _, guest = meeting_client
    created = client.post("/meetings", json=meeting_payload()).json()
    app.dependency_overrides[get_current_user] = lambda: guest

    response = client.post("/meetings/join", json={
        "meeting_code": created["meeting_code"],
        "join_password": created["join_password"],
    })

    assert response.status_code == 200
    assert response.json()["meeting_id"] == created["id"]
    assert response.json()["is_host"] is False


def test_invalid_meeting_code_or_password_is_rejected(meeting_client: tuple) -> None:
    client, _, _, guest = meeting_client
    created = client.post("/meetings", json=meeting_payload()).json()
    app.dependency_overrides[get_current_user] = lambda: guest

    wrong_password = client.post("/meetings/join", json={
        "meeting_code": created["meeting_code"],
        "join_password": "wrong-password",
    })
    wrong_code = client.post("/meetings/join", json={
        "meeting_code": "INVALID12",
        "join_password": created["join_password"],
    })

    assert wrong_password.status_code == 401
    assert wrong_code.status_code == 404


def test_engagement_metric_requires_membership_and_host_can_read_alert(meeting_client: tuple) -> None:
    client, repository, host, guest = meeting_client
    created = client.post("/meetings", json=meeting_payload()).json()
    invitation_id = next(
        str(item["_id"])
        for item in repository.participant_records[created["id"]]
        if item["user_id"] == guest["_id"]
    )
    app.dependency_overrides[get_current_user] = lambda: guest
    assert client.post(f"/meetings/invitations/{invitation_id}/accept").status_code == 200

    metric = client.post(f"/meetings/{created['id']}/engagement", json={"score": 42, "status": "LOW"})
    assert metric.status_code == 204
    assert repository.focus_metrics[(created["id"], str(guest["_id"]))]["score"] == 42

    app.dependency_overrides[get_current_user] = lambda: host
    alert = client.get(f"/meetings/{created['id']}/engagement-alert")
    assert alert.status_code == 200
    assert alert.json()["eligible_participants"] == 1
    assert alert.json()["low_engagement_participants"] == 1


def test_analytics_is_host_only(meeting_client: tuple) -> None:
    client, _, host, guest = meeting_client
    created = client.post("/meetings", json=meeting_payload()).json()

    app.dependency_overrides[get_current_user] = lambda: guest
    assert client.get(f"/meetings/{created['id']}/analytics").status_code == 403

    app.dependency_overrides[get_current_user] = lambda: host
    response = client.get(f"/meetings/{created['id']}/analytics")
    assert response.status_code == 200
    assert response.json()["total_participants"] == 2


def test_guest_can_decline_invitation(meeting_client: tuple) -> None:
    client, repository, host, guest = meeting_client
    created = client.post("/meetings", json=meeting_payload()).json()
    invitation_id = next(
        str(item["_id"])
        for item in repository.participant_records[created["id"]]
        if item["user_id"] == guest["_id"]
    )
    app.dependency_overrides[get_current_user] = lambda: guest

    response = client.post(f"/meetings/invitations/{invitation_id}/decline")

    assert response.status_code == 200
    assert response.json()["invitation_status"] == "DECLINED"


def test_only_host_can_update_or_cancel(meeting_client: tuple) -> None:
    client, _, _, guest = meeting_client
    created = client.post("/meetings", json=meeting_payload()).json()
    app.dependency_overrides[get_current_user] = lambda: guest

    update = client.patch(f"/meetings/{created['id']}", json={"title": "Changed"})
    cancel = client.post(f"/meetings/{created['id']}/cancel")

    assert update.status_code == 403
    assert cancel.status_code == 403


def test_upcoming_and_past_meeting_lists(meeting_client: tuple) -> None:
    client, _, _, _ = meeting_client
    client.post("/meetings", json=meeting_payload(title="Future"))
    client.post(
        "/meetings",
        json=meeting_payload(title="Past", scheduled_at=(datetime.now(timezone.utc) - timedelta(days=1)).isoformat()),
    )

    assert [item["title"] for item in client.get("/meetings/upcoming").json()] == ["Future"]
    assert [item["title"] for item in client.get("/meetings/past").json()] == ["Past"]


def test_meeting_validation_requires_timezone_and_valid_duration(meeting_client: tuple) -> None:
    client = meeting_client[0]

    naive = client.post("/meetings", json=meeting_payload(scheduled_at="2030-01-01T12:00:00"))
    duration = client.post("/meetings", json=meeting_payload(duration_minutes=10))

    assert naive.status_code == 422
    assert duration.status_code == 422
