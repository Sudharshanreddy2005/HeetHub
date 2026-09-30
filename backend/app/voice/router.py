from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from ..config import Settings, get_settings
from ..meetings.dependencies import CurrentUser, MeetingRepo
from ..chat.router import require_chat_access
from .models import VoiceModerationResponse, VoiceTranscriptRequest
from .service import enforce_voice_rate_limit, moderate_transcript, moderation_action

router = APIRouter(prefix="/meetings", tags=["voice moderation"])


@router.post("/{meeting_id}/voice-moderation", response_model=VoiceModerationResponse)
async def moderate_voice_transcript(
    meeting_id: str,
    request: VoiceTranscriptRequest,
    current_user: CurrentUser,
    repository: MeetingRepo,
    settings: Settings = Depends(get_settings),
) -> VoiceModerationResponse:
    """Moderate an opted-in, final transcript without accepting or storing audio."""
    await require_chat_access(meeting_id, current_user, repository)
    if not request.consent_given:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Voice moderation consent is required")
    if not settings.voice_moderation_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Voice moderation is unavailable")
    if len(request.transcript) > settings.voice_transcript_max_length:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Transcript is too long")
    try:
        enforce_voice_rate_limit(meeting_id, str(current_user["_id"]), settings)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(error)) from error

    result = moderate_transcript(request.transcript, settings)
    action = moderation_action(result.decision)
    # Retain only minimum host-review metadata. Never add the transcript or
    # microphone bytes to this event, logs, or another collection.
    await repository.create_moderation_event(
        {
            "meeting_id": repository.object_id(meeting_id),
            "user_id": current_user["_id"],
            "username": current_user["username"],
            "type": "voice_transcript",
            "decision": result.decision,
            "score": result.score,
            "action": action,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return VoiceModerationResponse(decision=result.decision, score=result.score, action=action)
