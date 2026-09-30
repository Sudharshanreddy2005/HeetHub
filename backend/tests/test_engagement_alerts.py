from datetime import datetime, timedelta, timezone

from app.config import Settings
from app.engagement_service import engagement_alert


def alert_settings(**overrides: object) -> Settings:
    return Settings(jwt_secret="test-secret-with-at-least-32-bytes-long", engagement_alert_duration_seconds=30, **overrides)


def test_alert_requires_more_than_half_for_minimum_duration() -> None:
    settings = alert_settings()
    metrics = [{"status": "LOW"}, {"status": "LOW"}, {"status": "HIGH"}, {"status": "UNAVAILABLE"}]

    first, low_since, last_alert = engagement_alert(metrics, settings, None, None)
    assert first["alert"] is False
    assert low_since is not None
    assert last_alert is None

    second, _, _ = engagement_alert(metrics, settings, datetime.now(timezone.utc) - timedelta(seconds=31), None)
    assert second["alert"] is True
    assert second["low_engagement_rate"] == 2 / 3


def test_alert_ignores_unavailable_and_respects_cooldown() -> None:
    settings = alert_settings()
    metrics = [{"status": "LOW"}, {"status": "LOW"}, {"status": "UNAVAILABLE"}]
    now = datetime.now(timezone.utc)

    triggered, _, last_alert = engagement_alert(metrics, settings, now - timedelta(seconds=31), None)
    assert triggered["alert"] is True
    suppressed, _, _ = engagement_alert(metrics, settings, now, last_alert)
    assert suppressed["alert"] is False