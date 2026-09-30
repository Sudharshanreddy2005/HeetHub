from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.config import Settings, get_settings
from app.main import app
from app.meetings.dependencies import get_meeting_repository
from app.voice.service import recent_voice_submissions


class FakeVoiceRepository:
    def __init__(self, host: dict[str, Any], guest: dict[str, Any]) -> None:
        self.meeting = {"_id": ObjectId(), "status": "LIVE", "host_id": host["_id"]}
        self.records = [
            {"user_id": host["_id"], "username": host["username"], "invitation_status": "ACCEPTED"},
            {"user_id": guest["_id"], "username": guest["username"], "invitation_status": "ACCEPTED"},
        ]
        self.events: list[dict[str, Any]] = []

    @staticmethod
    def object_id(meeting_id: str) -> ObjectId:
        return ObjectId(meeting_id)

    async def get(self, meeting_id: str) -> dict[str, Any] | None:
        return self.meeting if meeting_id == str(self.meeting["_id"]) else None

    async def participants(self, meeting_id: str) -> list[dict[str, Any]]:
        return self.records

    async def create_moderation_event(self, event: dict[str, Any]) -> dict[str, Any]:
        event["_id"] = ObjectId()
        self.events.append(event)
        return event


@pytest.fixture
def voice_client() -> tuple[TestClient, FakeVoiceRepository, dict[str, Any], dict[str, Any]]:
    recent_voice_submissions.clear()
    host = {"_id": ObjectId(), "username": "host"}
    guest = {"_id": ObjectId(), "username": "guest"}
    repository = FakeVoiceRepository(host, guest)
    app.dependency_overrides[get_current_user] = lambda: guest
    app.dependency_overrides[get_meeting_repository] = lambda: repository
    app.dependency_overrides[get_settings] = lambda: Settings(
        jwt_secret="test-secret-with-at-least-32-bytes-long",
        toxicity_model_enabled=False,
        voice_rate_limit_per_minute=2,
    )
    with TestClient(app) as client:
        yield client, repository, host, guest
    app.dependency_overrides.clear()
    recent_voice_submissions.clear()


def voice_url(repository: FakeVoiceRepository) -> str:
    return f"/meetings/{repository.meeting['_id']}/voice-moderation"


def voice_payload(transcript: str, consent_given: bool = True) -> dict[str, object]:
    return {"transcript": transcript, "consent_given": consent_given}


def test_safe_voice_transcript_persists_only_minimum_metadata(voice_client: tuple) -> None:
    client, repository, _, _ = voice_client

    response = client.post(voice_url(repository), json=voice_payload("Thank you for the helpful update"))

    assert response.status_code == 200
    assert response.json()["decision"] == "SAFE"
    assert repository.events[0]["type"] == "voice_transcript"
    assert repository.events[0]["action"] == "allowed"
    assert "transcript" not in repository.events[0]
    assert "audio" not in repository.events[0]


def test_warning_and_block_voice_decisions(voice_client: tuple) -> None:
    client, repository, _, _ = voice_client

    warning = client.post(voice_url(repository), json=voice_payload("You are an idiot"))
    block = client.post(voice_url(repository), json=voice_payload("You are an idiot and stupid"))

    assert warning.json()["decision"] == "WARNING"
    assert warning.json()["action"] == "flagged"
    assert block.json()["decision"] == "BLOCK"
    assert block.json()["action"] == "blocked"
    assert [event["decision"] for event in repository.events] == ["WARNING", "BLOCK"]


def test_voice_rejects_unaccepted_blocked_and_inactive_meetings(voice_client: tuple) -> None:
    client, repository, _, _ = voice_client
    repository.records[1]["invitation_status"] = "PENDING"
    assert client.post(voice_url(repository), json=voice_payload("Hello")).status_code == 403

    repository.records[1]["invitation_status"] = "BLOCKED"
    assert client.post(voice_url(repository), json=voice_payload("Hello")).status_code == 403

    repository.records[1]["invitation_status"] = "ACCEPTED"
    repository.meeting["status"] = "ENDED"
    assert client.post(voice_url(repository), json=voice_payload("Hello")).status_code == 409

    repository.meeting["status"] = "CANCELLED"
    assert client.post(voice_url(repository), json=voice_payload("Hello")).status_code == 409


def test_voice_rate_limit_and_audio_payload_rejection(voice_client: tuple) -> None:
    client, repository, _, _ = voice_client

    assert client.post(voice_url(repository), json=voice_payload("One")).status_code == 200
    assert client.post(voice_url(repository), json=voice_payload("Two")).status_code == 200
    assert client.post(voice_url(repository), json=voice_payload("Three")).status_code == 429

    recent_voice_submissions.clear()
    rejected_audio = client.post(voice_url(repository), json={**voice_payload("Hello"), "audio": "base64-audio"})
    assert rejected_audio.status_code == 422


def test_voice_requires_explicit_consent(voice_client: tuple) -> None:
    client, repository, _, _ = voice_client

    missing = client.post(voice_url(repository), json={"transcript": "Hello"})
    declined = client.post(voice_url(repository), json=voice_payload("Hello", consent_given=False))

    assert missing.status_code == 422
    assert declined.status_code == 403


def test_transcript_is_not_written_to_logs(voice_client: tuple, caplog: pytest.LogCaptureFixture) -> None:
    client, repository, _, _ = voice_client
    sensitive_phrase = "private spoken phrase 8675309"

    response = client.post(voice_url(repository), json=voice_payload(sensitive_phrase))

    assert response.status_code == 200
    assert sensitive_phrase not in caplog.text


def test_model_failure_uses_lexical_fallback(voice_client: tuple, monkeypatch: pytest.MonkeyPatch) -> None:
    client, repository, _, _ = voice_client
    app.dependency_overrides[get_settings] = lambda: Settings(
        jwt_secret="test-secret-with-at-least-32-bytes-long", toxicity_model_enabled=True
    )
    monkeypatch.setattr("app.moderation.service.classify_with_model", lambda *_: (_ for _ in ()).throw(RuntimeError()))

    response = client.post(voice_url(repository), json=voice_payload("You are an idiot and stupid"))

    assert response.status_code == 200
    assert response.json()["decision"] == "BLOCK"
