from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class ModerationDecision(StrEnum):
    SAFE = "SAFE"
    WARNING = "WARNING"
    BLOCK = "BLOCK"


class ModerationAction(StrEnum):
    WARN = "WARN"
    MUTE = "MUTE"
    UNMUTE = "UNMUTE"
    DISABLE_CHAT = "DISABLE_CHAT"
    ENABLE_CHAT = "ENABLE_CHAT"
    REMOVE = "REMOVE"
    BLOCK = "BLOCK"
    DISABLE_CAMERA = "DISABLE_CAMERA"
    ENABLE_CAMERA = "ENABLE_CAMERA"
    DISABLE_SCREEN_SHARE = "DISABLE_SCREEN_SHARE"
    ENABLE_SCREEN_SHARE = "ENABLE_SCREEN_SHARE"


class ModerationEventResponse(BaseModel):
    id: str
    username: str
    type: str
    decision: ModerationDecision
    score: float
    action: str
    created_at: datetime


class ModerationActionRequest(BaseModel):
    action: ModerationAction
