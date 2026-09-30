from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from ..config import Settings, get_settings
from ..meetings.dependencies import CurrentUser, MeetingRepo
from ..meetings.router import require_access
from ..moderation.models import ModerationDecision
from ..moderation.service import classify_text
from .models import MessageResponse, SendMessageRequest
from .service import broadcast_message, enforce_rate_limit

router = APIRouter(prefix="/meetings", tags=["chat"])


def response(message: dict) -> MessageResponse:
    return MessageResponse(
        id=str(message["_id"]), meeting_id=str(message["meeting_id"]), username=message["username"],
        content=message["content"], created_at=message["created_at"],
        moderation_decision=message.get("moderation_decision", ModerationDecision.SAFE)
    )


async def require_chat_access(meeting_id: str, current_user: dict, repository: MeetingRepo) -> dict:
    meeting = await require_access(meeting_id, current_user, repository)
    if meeting["status"] not in {"SCHEDULED", "LIVE"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Chat is unavailable for this meeting")
    controls = getattr(repository, "meeting_controls", lambda _meeting: {"allow_chat": True})(meeting)
    if not controls["allow_chat"] and meeting["host_id"] != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat has been disabled by the host")
    return meeting


@router.get("/{meeting_id}/messages", response_model=list[MessageResponse])
async def message_history(meeting_id: str, current_user: CurrentUser, repository: MeetingRepo) -> list[MessageResponse]:
    await require_chat_access(meeting_id, current_user, repository)
    return [response(message) for message in await repository.list_messages(meeting_id)]


@router.post("/{meeting_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    meeting_id: str,
    request: SendMessageRequest,
    current_user: CurrentUser,
    repository: MeetingRepo,
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    await require_chat_access(meeting_id, current_user, repository)
    participant = next(
        (item for item in await repository.participants(meeting_id) if item["user_id"] == current_user["_id"]), None
    )
    if participant and participant.get("chat_disabled", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat is disabled for this participant")
    try:
        enforce_rate_limit(meeting_id, str(current_user["_id"]), settings)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(error)) from error
    result = classify_text(request.content, settings)
    event = {
        "meeting_id": repository.object_id(meeting_id),
        "user_id": current_user["_id"],
        "username": current_user["username"],
        "type": "toxic_message" if result.decision != ModerationDecision.SAFE else "message_review",
        "decision": result.decision,
        "score": result.score,
        "action": "blocked" if result.decision == ModerationDecision.BLOCK else "allowed",
        "created_at": datetime.now(timezone.utc),
    }
    await repository.create_moderation_event(event)
    if result.decision == ModerationDecision.BLOCK:
        raise HTTPException(status_code=422, detail="Potentially abusive content detected")
    message = await repository.create_message(
        meeting_id, current_user["_id"], current_user["username"], request.content.strip(), result.decision
    )
    await broadcast_message(f"meeting-{meeting_id}", message, settings)
    return response(message)
