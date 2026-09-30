from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from ..config import Settings, get_settings
from ..meetings.dependencies import CurrentUser, MeetingRepo
from ..meetings.router import require_access
from .livekit import remove_from_room, set_microphone_muted, set_tracks_muted
from .models import ModerationAction, ModerationActionRequest, ModerationEventResponse

router = APIRouter(prefix="/meetings", tags=["moderation"])


def event_response(event: dict) -> ModerationEventResponse:
    return ModerationEventResponse(
        id=str(event["_id"]), username=event["username"], type=event["type"],
        decision=event["decision"], score=event["score"], action=event["action"], created_at=event["created_at"]
    )


@router.get("/{meeting_id}/moderation", response_model=list[ModerationEventResponse])
async def moderation_history(meeting_id: str, current_user: CurrentUser, repository: MeetingRepo) -> list[ModerationEventResponse]:
    meeting = await require_access(meeting_id, current_user, repository)
    if meeting["host_id"] != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can view moderation events")
    return [event_response(event) for event in await repository.list_moderation_events(meeting_id)]


@router.post("/{meeting_id}/moderation/{user_id}", response_model=ModerationEventResponse)
async def moderate_participant(
    meeting_id: str,
    user_id: str,
    request: ModerationActionRequest,
    current_user: CurrentUser,
    repository: MeetingRepo,
    settings: Settings = Depends(get_settings),
) -> ModerationEventResponse:
    meeting = await require_access(meeting_id, current_user, repository)
    if meeting["host_id"] != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can moderate participants")
    from bson import ObjectId

    try:
        participant_id = ObjectId(user_id)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found") from error
    participant = next((item for item in await repository.participants(meeting_id) if item["user_id"] == participant_id), None)
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    if participant_id == current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Hosts cannot moderate themselves")
    action = request.action
    changes: dict = {"updated_at": datetime.now(timezone.utc)}
    if action == ModerationAction.MUTE:
        changes["muted_until"] = datetime.now(timezone.utc) + timedelta(minutes=5)
    elif action == ModerationAction.UNMUTE:
        changes["muted_until"] = None
    elif action == ModerationAction.DISABLE_CHAT:
        changes["chat_disabled"] = True
    elif action == ModerationAction.ENABLE_CHAT:
        changes["chat_disabled"] = False
    elif action == ModerationAction.DISABLE_CAMERA:
        changes["camera_disabled"] = True
    elif action == ModerationAction.ENABLE_CAMERA:
        changes["camera_disabled"] = False
    elif action == ModerationAction.DISABLE_SCREEN_SHARE:
        changes["screen_share_disabled"] = True
    elif action == ModerationAction.ENABLE_SCREEN_SHARE:
        changes["screen_share_disabled"] = False
    elif action in {ModerationAction.REMOVE, ModerationAction.BLOCK}:
        changes["invitation_status"] = "REMOVED" if action == ModerationAction.REMOVE else "BLOCKED"
    await repository.set_participant_control(meeting_id, participant_id, changes)
    room_name = f"meeting-{meeting_id}"
    if action == ModerationAction.MUTE:
        await set_microphone_muted(room_name, str(participant_id), True, settings)
    elif action == ModerationAction.UNMUTE:
        # This only lifts the host restriction. It does not silently turn a
        # participant's microphone on; the participant remains in control.
        await set_microphone_muted(room_name, str(participant_id), False, settings)
    elif action in {ModerationAction.DISABLE_CAMERA, ModerationAction.ENABLE_CAMERA}:
        await set_tracks_muted(room_name, str(participant_id), "video", action == ModerationAction.DISABLE_CAMERA, settings)
    elif action in {ModerationAction.REMOVE, ModerationAction.BLOCK}:
        await remove_from_room(room_name, str(participant_id), settings)
    event = await repository.create_moderation_event({
        "meeting_id": repository.object_id(meeting_id), "user_id": participant_id,
        "username": participant["username"], "type": "host_action", "decision": "SAFE", "score": 0.0,
        "action": action, "created_at": datetime.now(timezone.utc),
    })
    return event_response(event)
