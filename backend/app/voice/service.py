"""Voice-transcript moderation without audio retention or audio logging."""

from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from ..config import Settings
from ..moderation.models import ModerationDecision
from ..moderation.service import ToxicityResult, classify_voice_transcript

recent_voice_submissions: dict[tuple[str, str], deque[datetime]] = defaultdict(deque)


def enforce_voice_rate_limit(meeting_id: str, user_id: str, settings: Settings) -> None:
    key = (meeting_id, user_id)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=1)
    timestamps = recent_voice_submissions[key]
    while timestamps and timestamps[0] < cutoff:
        timestamps.popleft()
    if len(timestamps) >= settings.voice_rate_limit_per_minute:
        raise ValueError("Voice moderation rate limit exceeded")
    timestamps.append(datetime.now(timezone.utc))


def moderate_transcript(transcript: str, settings: Settings) -> ToxicityResult:
    """Return an assistive moderation decision; caller must not persist transcript."""
    return classify_voice_transcript(transcript, settings)


def moderation_action(decision: ModerationDecision) -> str:
    if decision == ModerationDecision.BLOCK:
        return "blocked"
    if decision == ModerationDecision.WARNING:
        return "flagged"
    return "allowed"
