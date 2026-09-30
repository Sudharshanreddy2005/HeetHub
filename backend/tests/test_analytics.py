from datetime import datetime, timedelta, timezone
from bson import ObjectId

from app.analytics_service import build_analytics


def test_build_analytics_aggregates_attendance_engagement_and_moderation() -> None:
    start = datetime.now(timezone.utc) - timedelta(minutes=5)
    end = datetime.now(timezone.utc) - timedelta(minutes=1)
    result = build_analytics(
        {"_id": ObjectId(), "status": "ENDED", "duration_minutes": 30},
        [
            {"username": "host", "role": "host", "invitation_status": "ACCEPTED", "joined_at": start, "left_at": end},
            {"username": "guest", "role": "participant", "invitation_status": "ACCEPTED", "joined_at": start, "left_at": end},
        ],
        [{"status": "HIGH", "score": 90}, {"status": "LOW", "score": 30}, {"status": "UNAVAILABLE", "score": 0}],
        [
            {"decision": "WARNING", "action": "flagged", "type": "voice_transcript"},
            {"decision": "BLOCK", "action": "blocked", "type": "toxic_message"},
            {"decision": "SAFE", "action": "MUTE", "type": "host_action"},
        ],
    )

    assert result["actual_duration_seconds"] == 240
    assert result["total_participants"] == 2
    assert result["engagement"] == {
        "high": 1, "moderate": 0, "low": 1, "unavailable": 1, "eligible": 2,
        "average_score": 60.0, "peak_score": 90, "lowest_score": 30,
    }
    assert result["moderation"]["total_events"] == 3
    assert result["moderation"]["warnings"] == 1
    assert result["moderation"]["blocked"] == 1
    assert result["moderation"]["muted"] == 1