from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field, field_validator


class MeetingStatus(StrEnum):
    SCHEDULED = "SCHEDULED"
    LIVE = "LIVE"
    ENDED = "ENDED"
    CANCELLED = "CANCELLED"


class InvitationStatus(StrEnum):
    INVITED = "INVITED"
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    JOINED = "JOINED"
    DECLINED = "DECLINED"
    REMOVED = "REMOVED"
    BLOCKED = "BLOCKED"


class CreateMeetingRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    scheduled_at: datetime
    duration_minutes: int = Field(ge=15, le=480)
    participant_usernames: list[str] = Field(default_factory=list, max_length=100)
    participant_emails: list[EmailStr] = Field(default_factory=list, max_length=100)

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("scheduled_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("scheduled_at must include a timezone")
        return value

    @field_validator("participant_usernames", mode="before")
    @classmethod
    def normalize_usernames(cls, value: object) -> object:
        if isinstance(value, list):
            return list(dict.fromkeys(item.strip().lower() for item in value if isinstance(item, str) and item.strip()))
        return value

    @field_validator("participant_emails", mode="before")
    @classmethod
    def normalize_emails(cls, value: object) -> object:
        if isinstance(value, list):
            normalized: list[str] = []
            seen: set[str] = set()
            for item in value:
                if not isinstance(item, str):
                    continue
                clean = item.strip().lower()
                if not clean or clean in seen:
                    continue
                seen.add(clean)
                normalized.append(clean)
            return normalized
        return value


class UpdateMeetingRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=480)

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("scheduled_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("scheduled_at must include a timezone")
        return value


class ParticipantResponse(BaseModel):
    username: str
    role: str
    invitation_status: InvitationStatus


class MeetingResponse(BaseModel):
    id: str
    title: str
    description: str
    scheduled_at: datetime
    duration_minutes: int
    status: MeetingStatus
    host_username: str
    meeting_code: str
    join_url: str
    join_password: str
    invited_emails: list[str] = Field(default_factory=list)
    participants: list[ParticipantResponse]


class InvitationResponse(BaseModel):
    id: str
    meeting_id: str
    meeting_title: str
    host_username: str
    scheduled_at: datetime
    duration_minutes: int
    invitation_status: InvitationStatus
    created_at: datetime


class MeetingAccessResponse(BaseModel):
    meeting_id: str
    room_name: str
    livekit_url: str
    token: str
    is_host: bool


class MeetingControls(BaseModel):
    allow_chat: bool = True
    allow_participant_microphone: bool = True
    allow_participant_camera: bool = True
    allow_screen_share: bool = True
    allow_reactions: bool = True
    allow_raise_hand: bool = True
    meeting_locked: bool = False
    waiting_room_enabled: bool = False
    join_before_host: bool = True


class UpdateMeetingControlsRequest(BaseModel):
    allow_chat: bool | None = None
    allow_participant_microphone: bool | None = None
    allow_participant_camera: bool | None = None
    allow_screen_share: bool | None = None
    allow_reactions: bool | None = None
    allow_raise_hand: bool | None = None
    meeting_locked: bool | None = None
    waiting_room_enabled: bool | None = None
    join_before_host: bool | None = None


class MeetingControlsResponse(MeetingControls):
    meeting_id: str
    is_host: bool


class ParticipantControlResponse(BaseModel):
    user_id: str
    username: str
    chat_allowed: bool
    microphone_allowed: bool
    camera_allowed: bool
    screen_share_allowed: bool


class UpdateParticipantControlsRequest(BaseModel):
    chat_allowed: bool | None = None
    microphone_allowed: bool | None = None
    camera_allowed: bool | None = None
    screen_share_allowed: bool | None = None


class MeetingJoinRequest(BaseModel):
    meeting_code: str = Field(min_length=1, max_length=32)
    join_password: str = Field(min_length=1, max_length=128)

    @field_validator("meeting_code", "join_password", mode="before")
    @classmethod
    def strip_strings(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class MeetingIdJoinRequest(BaseModel):
    meeting_id: str = Field(min_length=1, max_length=128)
    join_password: str = Field(min_length=1, max_length=128)

    @field_validator("meeting_id", "join_password", mode="before")
    @classmethod
    def strip_strings(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class InvitationTokenJoinRequest(BaseModel):
    token: str = Field(min_length=1, max_length=256)
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr

    @field_validator("token", "full_name", mode="before")
    @classmethod
    def strip_strings(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

