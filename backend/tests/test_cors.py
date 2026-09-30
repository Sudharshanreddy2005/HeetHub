from fastapi.testclient import TestClient

from app.main import app


def test_cors_allows_documented_browser_write_methods() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/meetings/example/messages",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
            },
        )

    assert response.status_code == 200
    assert "POST" in response.headers["access-control-allow-methods"]
