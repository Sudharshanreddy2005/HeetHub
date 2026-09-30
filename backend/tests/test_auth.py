from datetime import datetime, timedelta, timezone

import jwt
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from app.auth.dependencies import get_user_repository
from app.config import Settings, get_settings
from app.main import app

TEST_JWT_SECRET = "test-secret-with-at-least-32-bytes-long"


class FakeUserRepository:
    def __init__(self) -> None:
        self.users: dict[str, dict] = {}

    async def create(
        self,
        username: str,
        email: str,
        password_hash: str,
        full_name: str | None = None,
        phone: str | None = None,
    ) -> dict:
        if any(user["username"] == username or user["email"] == email for user in self.users.values()):
            raise ValueError("An account with that email or username already exists")
        user = {
            "_id": ObjectId(),
            "username": username,
            "email": email,
            "full_name": full_name or username,
            "phone": phone or "",
            "password_hash": password_hash,
            "role": "participant",
            "created_at": datetime.now(timezone.utc),
        }
        self.users[str(user["_id"])] = user
        return user

    async def find_by_email(self, email: str) -> dict | None:
        return next((user for user in self.users.values() if user["email"] == email), None)

    async def find_by_id(self, user_id: str) -> dict | None:
        return self.users.get(user_id)


@pytest.fixture
def client() -> tuple[TestClient, FakeUserRepository]:
    repository = FakeUserRepository()
    app.dependency_overrides[get_user_repository] = lambda: repository
    app.dependency_overrides[get_settings] = lambda: Settings(jwt_secret=TEST_JWT_SECRET)
    with TestClient(app) as test_client:
        yield test_client, repository
    app.dependency_overrides.clear()


def registration_payload(
    email: str = "person@example.com",
    username: str = "person",
    full_name: str = "Person Name",
    phone: str = "+1 (555) 123-4567",
    password: str = "StrongPass1",
    password_confirmation: str | None = None,
) -> dict:
    return {
        "username": username,
        "email": email,
        "full_name": full_name,
        "phone": phone,
        "password": password,
        "password_confirmation": password if password_confirmation is None else password_confirmation,
    }


def test_successful_registration(client: tuple[TestClient, FakeUserRepository]) -> None:
    response = client[0].post("/auth/register", json=registration_payload())

    assert response.status_code == 201
    assert response.json()["user"]["email"] == "person@example.com"
    assert response.json()["user"]["full_name"] == "Person Name"
    assert response.json()["user"]["phone"] == "+1 (555) 123-4567"
    assert "password_hash" not in response.json()["user"]
    assert next(iter(client[1].users.values()))["password_hash"] != "StrongPass1"


def test_duplicate_email(client: tuple[TestClient, FakeUserRepository]) -> None:
    test_client = client[0]
    test_client.post("/auth/register", json=registration_payload())

    assert test_client.post("/auth/register", json=registration_payload(username="another")).status_code == 409


def test_duplicate_username(client: tuple[TestClient, FakeUserRepository]) -> None:
    test_client = client[0]
    test_client.post("/auth/register", json=registration_payload())

    assert test_client.post("/auth/register", json=registration_payload(email="other@example.com")).status_code == 409


@pytest.mark.parametrize(
    ("payload", "status_code"),
    [
        ({"username": "person", "email": "not-an-email", "password": "StrongPass1", "full_name": "Person Name", "phone": "+1 (555) 123-4567", "password_confirmation": "StrongPass1"}, 422),
        ({"username": "person", "email": "person@example.com", "password": "weak", "full_name": "Person Name", "phone": "+1 (555) 123-4567", "password_confirmation": "weak"}, 422),
        ({"username": "person", "email": "person@example.com", "password": "StrongPass1", "full_name": "Person Name", "phone": "+1 (555) 123-4567", "password_confirmation": "DifferentPass1"}, 422),
    ],
)
def test_invalid_email_and_weak_password(
    client: tuple[TestClient, FakeUserRepository], payload: dict, status_code: int
) -> None:
    assert client[0].post("/auth/register", json=payload).status_code == status_code


def test_successful_login(client: tuple[TestClient, FakeUserRepository]) -> None:
    test_client = client[0]
    test_client.post("/auth/register", json=registration_payload())

    response = test_client.post("/auth/login", json={"email": "person@example.com", "password": "StrongPass1"})

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"


def test_incorrect_password(client: tuple[TestClient, FakeUserRepository]) -> None:
    test_client = client[0]
    test_client.post("/auth/register", json=registration_payload())

    response = test_client.post("/auth/login", json={"email": "person@example.com", "password": "WrongPass1"})

    assert response.status_code == 401


def test_nonexistent_user(client: tuple[TestClient, FakeUserRepository]) -> None:
    response = client[0].post("/auth/login", json={"email": "missing@example.com", "password": "StrongPass1"})

    assert response.status_code == 401


def test_valid_jwt_and_auth_me(client: tuple[TestClient, FakeUserRepository]) -> None:
    test_client = client[0]
    registration = test_client.post("/auth/register", json=registration_payload()).json()

    response = test_client.get("/auth/me", headers={"Authorization": f"Bearer {registration['access_token']}"})

    assert response.status_code == 200
    assert response.json()["username"] == "person"
    assert "password_hash" not in response.json()


@pytest.mark.parametrize(
    "token",
    [
        "not-a-jwt",
        jwt.encode({"sub": "missing", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}, TEST_JWT_SECRET, algorithm="HS256"),
        jwt.encode({"sub": "missing", "exp": datetime.now(timezone.utc) - timedelta(minutes=5)}, TEST_JWT_SECRET, algorithm="HS256"),
    ],
)
def test_invalid_expired_and_unknown_jwt(client: tuple[TestClient, FakeUserRepository], token: str) -> None:
    response = client[0].get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_missing_jwt(client: tuple[TestClient, FakeUserRepository]) -> None:
    assert client[0].get("/auth/me").status_code == 401
