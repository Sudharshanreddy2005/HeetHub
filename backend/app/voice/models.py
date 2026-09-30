from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..moderation.models import ModerationDecision


class VoiceTranscriptRequest(BaseModel):
    """Final browser-produced transcript only; raw audio is deliberately unsupported."""

    model_config = ConfigDict(extra="forbid")

    transcript: str = Field(min_length=1)
    consent_given: bool

    @field_validator("transcript", mode="before")
    @classmethod
    def normalize_transcript(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
        if value == "":
            raise ValueError("Transcript cannot be empty")
        return value


class VoiceModerationResponse(BaseModel):
    decision: ModerationDecision
    score: float
    action: str
