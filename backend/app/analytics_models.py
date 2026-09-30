from datetime import datetime

from pydantic import BaseModel


class AttendanceRecord(BaseModel):
    username: str
    role: str
    invitation_status: str
    joined_at: datetime | None = None
    left_at: datetime | None = None


class EngagementDistribution(BaseModel):
    high: int
    moderate: int
    low: int
    unavailable: int
    eligible: int
    average_score: float | None = None
    peak_score: int | None = None
    lowest_score: int | None = None


class ModerationOutcomes(BaseModel):
    total_events: int
    warnings: int
    blocked: int
    allowed: int
    host_actions: int
    muted: int
    removed: int
    blocked_participants: int


class MeetingAnalyticsResponse(BaseModel):
    meeting_id: str
    meeting_status: str
    scheduled_duration_minutes: int
    actual_duration_seconds: int
    attendance: list[AttendanceRecord]
    total_participants: int
    engagement: EngagementDistribution
    moderation: ModerationOutcomes