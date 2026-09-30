from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class EngagementStatus(StrEnum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    UNAVAILABLE = "UNAVAILABLE"


class EngagementMetricRequest(BaseModel):
    score: int = Field(ge=0, le=100)
    status: EngagementStatus

    @model_validator(mode="after")
    def validate_unavailable_score(self) -> "EngagementMetricRequest":
        if self.status == EngagementStatus.UNAVAILABLE and self.score != 0:
            raise ValueError("Unavailable engagement must have a zero score")
        return self


class EngagementAlertResponse(BaseModel):
    alert: bool
    message: str | None = None
    low_engagement_rate: float
    eligible_participants: int
    low_engagement_participants: int
    low_since: datetime | None = None
    cooldown_until: datetime | None = None