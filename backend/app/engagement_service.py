from datetime import datetime, timedelta, timezone
from typing import Any

from .config import Settings


def engagement_alert(
    metrics: list[dict[str, Any]], settings: Settings, low_since: datetime | None, last_alert_at: datetime | None
) -> tuple[dict[str, Any], datetime | None, datetime | None]:
    now = datetime.now(timezone.utc)
    eligible = [metric for metric in metrics if metric.get("status") != "UNAVAILABLE"]
    low_count = sum(metric.get("status") == "LOW" for metric in eligible)
    rate = low_count / len(eligible) if eligible else 0.0
    above_threshold = bool(eligible) and rate > settings.engagement_alert_threshold
    if not above_threshold:
        return {
            "alert": False, "message": None, "low_engagement_rate": rate,
            "eligible_participants": len(eligible), "low_engagement_participants": low_count,
            "low_since": None, "cooldown_until": None,
        }, None, last_alert_at
    if low_since is None:
        low_since = now
    cooldown_until = last_alert_at + timedelta(seconds=settings.engagement_alert_cooldown_seconds) if last_alert_at else None
    duration_met = now - low_since >= timedelta(seconds=settings.engagement_alert_duration_seconds)
    cooldown_active = cooldown_until is not None and now < cooldown_until
    triggered = duration_met and not cooldown_active
    if triggered:
        last_alert_at = now
        cooldown_until = now + timedelta(seconds=settings.engagement_alert_cooldown_seconds)
    return {
        "alert": triggered,
        "message": "More than 50% of eligible participants currently show low visual engagement. Consider changing the meeting format or pace." if triggered else None,
        "low_engagement_rate": rate,
        "eligible_participants": len(eligible),
        "low_engagement_participants": low_count,
        "low_since": low_since,
        "cooldown_until": cooldown_until,
    }, low_since, last_alert_at