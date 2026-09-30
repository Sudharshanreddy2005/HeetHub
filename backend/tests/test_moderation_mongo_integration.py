"""Opt-in MongoDB integration coverage for the Phase 7 moderation flow."""

import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.main import app


pytestmark = pytest.mark.skipif(not os.getenv("MONGODB_URI"), reason="MongoDB integration environment is not configured")


def test_moderation_persists_and_block_revokes_chat_access() -> None:
    suffix = uuid4().hex[:12]
    host_email = f"host-{suffix}@example.com"
    guest_email = f"guest-{suffix}@example.com"
    host_username = f"host{suffix}"
    guest_username = f"guest{suffix}"
    database_name = os.environ.get("MONGODB_DATABASE", "ai_secure_meeting")
    mongo = MongoClient(os.environ["MONGODB_URI"])[database_name]

    with TestClient(app) as client:
        host_response = client.post(
            "/auth/register",
            json={
                "username": host_username,
                "email": host_email,
                "full_name": "Mongo Test Host",
                "password": "StrongPass1",
                "password_confirmation": "StrongPass1",
            },
        )
        guest_response = client.post(
            "/auth/register",
            json={
                "username": guest_username,
                "email": guest_email,
                "full_name": "Mongo Test Guest",
                "password": "StrongPass1",
                "password_confirmation": "StrongPass1",
            },
        )
        assert host_response.status_code == 201, host_response.text
        assert guest_response.status_code == 201, guest_response.text
        host = host_response.json()
        guest = guest_response.json()
        host_headers = {"Authorization": f"Bearer {host['access_token']}"}
        guest_headers = {"Authorization": f"Bearer {guest['access_token']}"}

        try:
            meeting = client.post(
                "/meetings",
                headers=host_headers,
                json={
                    "title": "Mongo moderation test",
                    "description": "",
                    "scheduled_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                    "duration_minutes": 30,
                    "participant_usernames": [guest_username],
                },
            ).json()
            invitation = client.get("/meetings/invitations", headers=guest_headers).json()[0]
            assert client.post(f"/meetings/invitations/{invitation['id']}/accept", headers=guest_headers).status_code == 200

            message = client.post(
                f"/meetings/{meeting['id']}/messages", headers=guest_headers, json={"content": "Thanks everyone"}
            )
            assert message.status_code == 201
            assert message.json()["moderation_decision"] == "SAFE"

            blocked = client.post(
                f"/meetings/{meeting['id']}/moderation/{guest['user']['id']}",
                headers=host_headers,
                json={"action": "BLOCK"},
            )
            assert blocked.status_code == 200
            assert client.post(
                f"/meetings/{meeting['id']}/messages", headers=guest_headers, json={"content": "Can I bypass this?"}
            ).status_code == 403

            meeting_object_id = ObjectId(meeting["id"])
            assert mongo.messages.count_documents({"meeting_id": meeting_object_id}) == 1
            assert mongo.moderation_events.count_documents({"meeting_id": meeting_object_id}) >= 2
            assert len(client.get(f"/meetings/{meeting['id']}/moderation", headers=host_headers).json()) >= 2
        finally:
            # The data is test-only and is cleaned by normalized email/username
            # rather than exposing a production cleanup endpoint.
            user_ids = [item["_id"] for item in mongo.users.find({"email": {"$in": [host_email, guest_email]}})]
            meeting_ids = [item["_id"] for item in mongo.meetings.find({"host_username": host_username})]
            mongo.users.delete_many({"_id": {"$in": user_ids}})
            mongo.meetings.delete_many({"_id": {"$in": meeting_ids}})
            mongo.meeting_participants.delete_many({"meeting_id": {"$in": meeting_ids}})
            mongo.messages.delete_many({"meeting_id": {"$in": meeting_ids}})
            mongo.moderation_events.delete_many({"meeting_id": {"$in": meeting_ids}})
            mongo.notifications.delete_many({"user_id": {"$in": user_ids}})
    mongo.client.close()
