from datetime import datetime, timezone
from typing import Any


def build_analytics(meeting: dict[str, Any], participants: list[dict[str, Any]], metrics: list[dict[str, Any]], events: list[dict[str, Any]]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    joined = [item["joined_at"] for item in participants if isinstance(item.get("joined_at"), datetime)]
    left = [item["left_at"] for item in participants if isinstance(item.get("left_at"), datetime)]
    actual_start = min(joined) if joined else None
    actual_end = max(left) if left else (now if actual_start and meeting["status"] == "LIVE" else actual_start)
    duration = int(max(0, (actual_end - actual_start).total_seconds())) if actual_start and actual_end else 0

    high = sum(item.get("status") == "HIGH" for item in metrics)
    moderate = sum(item.get("status") == "MODERATE" for item in metrics)
    low = sum(item.get("status") == "LOW" for item in metrics)
    unavailable = sum(item.get("status") == "UNAVAILABLE" for item in metrics)
    scores = [int(item["score"]) for item in metrics if item.get("status") != "UNAVAILABLE" and isinstance(item.get("score"), (int, float))]
    eligible = high + moderate + low
    moderation_decisions = [str(item.get("decision", "")) for item in events]
    actions = [str(item.get("action", "")) for item in events]
    return {
        "meeting_id": str(meeting["_id"]),
        "meeting_status": meeting["status"],
        "scheduled_duration_minutes": meeting["duration_minutes"],
        "actual_duration_seconds": duration,
        "attendance": [
            {
                "username": item["username"],
                "role": item["role"],
                "invitation_status": item["invitation_status"],
                "joined_at": item.get("joined_at"),
                "left_at": item.get("left_at"),
            }
            for item in participants
        ],
        "total_participants": len(participants),
        "engagement": {
            "high": high, "moderate": moderate, "low": low, "unavailable": unavailable,
            "eligible": eligible,
            "average_score": round(sum(scores) / len(scores), 2) if scores else None,
            "peak_score": max(scores) if scores else None,
            "lowest_score": min(scores) if scores else None,
        },
        "moderation": {
            "total_events": len(events),
            "warnings": moderation_decisions.count("WARNING"),
            "blocked": moderation_decisions.count("BLOCK"),
            "allowed": actions.count("allowed"),
            "host_actions": actions.count("ModerationAction.HOST_ACTION") + sum(item.get("type") == "host_action" for item in events),
            "muted": actions.count("MUTE"),
            "removed": actions.count("REMOVE"),
            "blocked_participants": actions.count("BLOCK"),
        },
    }