from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content", mode="before")
    @classmethod
    def strip_content(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
        if value == "":
            raise ValueError("Message cannot be empty")
        return value


class MessageResponse(BaseModel):
    id: str
    meeting_id: str
    username: str
    content: str
    created_at: datetime
    moderation_decision: str = "SAFE"
