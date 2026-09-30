import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..config import Settings, get_settings
from .dependencies import CurrentUser, MeetingRepo, UserRepo
from .models import (
    CreateMeetingRequest,
    InvitationResponse,
    InvitationStatus,
    InvitationTokenJoinRequest,
    MeetingAccessResponse,
    MeetingControlsResponse,
    MeetingJoinRequest,
    MeetingResponse,
    MeetingStatus,
    ParticipantResponse,
    ParticipantControlResponse,
    UpdateMeetingControlsRequest,
    UpdateParticipantControlsRequest,
    UpdateMeetingRequest,
)
from .livekit import create_meeting_token
from ..engagement_models import EngagementAlertResponse, EngagementMetricRequest, EngagementStatus
from ..engagement_service import engagement_alert
from ..analytics_models import MeetingAnalyticsResponse
from ..analytics_service import build_analytics
from ..moderation.livekit import remove_from_room
from ..moderation.livekit import set_tracks_muted

engagement_alert_state: dict[str, tuple[datetime | None, datetime | None]] = {}

DEFAULT_MEETING_CONTROLS = {
    "allow_chat": True,
    "allow_participant_microphone": True,
    "allow_participant_camera": True,
    "allow_screen_share": True,
    "allow_reactions": True,
    "allow_raise_hand": True,
    "meeting_locked": False,
    "waiting_room_enabled": False,
    "join_before_host": True,
}

router = APIRouter(prefix="/meetings", tags=["meetings"])


def generate_invitation_token() -> str:
    return secrets.token_urlsafe(32)


def hash_invitation_token(token: str) -> str:
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()


async def guest_invitation_status_for_email(meeting: dict, email: str, repository: MeetingRepo) -> dict | None:
    normalized = (email or "").strip().lower()
    if not normalized:
        return None
    for item in await repository.participants(str(meeting["_id"])):
        if (item.get("email") or "").strip().lower() == normalized:
            return item
    return None


@router.post("/{meeting_id}/engagement", status_code=status.HTTP_204_NO_CONTENT)
async def submit_engagement_metric(
    meeting_id: str,
    request: EngagementMetricRequest,
    current_user: CurrentUser,
    repository: MeetingRepo,
) -> None:
    """Store only the authenticated participant's latest local estimate."""
    meeting = await require_access(meeting_id, current_user, repository)
    if meeting["status"] not in {MeetingStatus.SCHEDULED, MeetingStatus.LIVE}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Engagement metrics are unavailable for this meeting")
    if request.status == EngagementStatus.UNAVAILABLE and request.score != 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unavailable engagement must have a zero score")
    participant = next(
        (item for item in await repository.participants(meeting_id) if item["user_id"] == object_id(current_user)), None
    )
    if participant is None or participant["invitation_status"] != InvitationStatus.ACCEPTED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="An accepted invitation is required")
    await repository.upsert_focus_metric(
        meeting_id,
        object_id(current_user),
        {"score": request.score, "status": request.status, "updated_at": datetime.now(timezone.utc)},
    )


@router.get("/{meeting_id}/engagement-alert", response_model=EngagementAlertResponse)
async def get_engagement_alert(
    meeting_id: str,
    current_user: CurrentUser,
    repository: MeetingRepo,
    settings: Settings = Depends(get_settings),
) -> EngagementAlertResponse:
    meeting = await require_access(meeting_id, current_user, repository)
    if meeting["host_id"] != object_id(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can view engagement alerts")
    now = datetime.now(timezone.utc)
    state = engagement_alert_state.get(meeting_id, (None, None))
    result, low_since, last_alert_at = engagement_alert(
        await repository.latest_focus_metrics(meeting_id, now - timedelta(seconds=settings.engagement_metric_stale_seconds)),
        settings,
        *state,
    )
    engagement_alert_state[meeting_id] = (low_since, last_alert_at)
    return EngagementAlertResponse(**result)


@router.get("/{meeting_id}/analytics", response_model=MeetingAnalyticsResponse)
async def meeting_analytics(
    meeting_id: str,
    current_user: CurrentUser,
    repository: MeetingRepo,
) -> MeetingAnalyticsResponse:
    meeting = await require_access(meeting_id, current_user, repository)
    if meeting["host_id"] != object_id(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can view meeting analytics")
    analytics = build_analytics(
        meeting,
        await repository.participants(meeting_id),
        await repository.all_focus_metrics(meeting_id),
        await repository.list_moderation_events(meeting_id),
    )
    return MeetingAnalyticsResponse(**analytics)


def object_id(user: dict) -> ObjectId:
    return user["_id"]


def controls_response(meeting: dict, viewer_id: ObjectId, repository: MeetingRepo) -> MeetingControlsResponse:
    controls = meeting_controls(repository, meeting)
    return MeetingControlsResponse(
        meeting_id=str(meeting["_id"]),
        is_host=meeting["host_id"] == viewer_id,
        **controls,
    )


def participant_controls_response(participant: dict, meeting: dict, repository: MeetingRepo) -> ParticipantControlResponse:
    controls = meeting_controls(repository, meeting)
    muted_until = participant.get("muted_until")
    microphone_allowed = controls["allow_participant_microphone"] and not participant.get("microphone_disabled", False)
    if isinstance(muted_until, datetime) and muted_until > datetime.now(timezone.utc):
        microphone_allowed = False
    return ParticipantControlResponse(
        user_id=str(participant["user_id"]),
        username=participant["username"],
        chat_allowed=controls["allow_chat"] and not participant.get("chat_disabled", False),
        microphone_allowed=microphone_allowed,
        camera_allowed=controls["allow_participant_camera"] and not participant.get("camera_disabled", False),
        screen_share_allowed=controls["allow_screen_share"] and not participant.get("screen_share_disabled", False),
    )


def allowed_publish_sources(meeting: dict, participant: dict | None, repository: MeetingRepo) -> list[str] | None:
    if participant is None or participant.get("role") == "host":
        return None
    controls = meeting_controls(repository, meeting)
    muted_until = participant.get("muted_until")
    microphone_allowed = controls["allow_participant_microphone"] and not participant.get("microphone_disabled", False)
    if isinstance(muted_until, datetime) and muted_until > datetime.now(timezone.utc):
        microphone_allowed = False
    sources: list[str] = []
    if microphone_allowed:
        sources.append("microphone")
    if controls["allow_participant_camera"] and not participant.get("camera_disabled", False):
        sources.append("camera")
    if controls["allow_screen_share"] and not participant.get("screen_share_disabled", False):
        sources.extend(["screen_share", "screen_share_audio"])
    return sources


def meeting_controls(repository: MeetingRepo, meeting: dict) -> dict[str, bool]:
    resolver = getattr(repository, "meeting_controls", None)
    if callable(resolver):
        return resolver(meeting)
    return dict(DEFAULT_MEETING_CONTROLS)


def enforce_join_controls(meeting: dict, participant: dict | None, records: list[dict], repository: MeetingRepo) -> None:
    if participant is None or participant.get("role") == "host":
        return
    controls = meeting_controls(repository, meeting)
    if controls["meeting_locked"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This meeting is locked")
    if controls["waiting_room_enabled"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Waiting room admission is required")
    if not controls["join_before_host"] and meeting["status"] == MeetingStatus.SCHEDULED:
        host_record = next((item for item in records if item.get("user_id") == meeting["host_id"]), None)
        if not host_record or not host_record.get("joined_at"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="The host must join before participants")


async def require_access(meeting_id: str, current_user: dict, repository: MeetingRepo) -> dict:
    meeting = await repository.get(meeting_id)
    if meeting is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    if meeting["host_id"] == object_id(current_user):
        return meeting
    participant = next(
        (item for item in await repository.participants(meeting_id) if item["user_id"] == object_id(current_user)), None
    )
    if participant is None or participant["invitation_status"] != InvitationStatus.ACCEPTED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to view this meeting")
    return meeting


@router.get("/{meeting_id}/controls", response_model=MeetingControlsResponse)
async def get_meeting_controls(meeting_id: str, current_user: CurrentUser, repository: MeetingRepo) -> MeetingControlsResponse:
    meeting = await require_access(meeting_id, current_user, repository)
    return controls_response(meeting, object_id(current_user), repository)


@router.patch("/{meeting_id}/controls", response_model=MeetingControlsResponse)
async def update_meeting_controls(
    meeting_id: str,
    request: UpdateMeetingControlsRequest,
    current_user: CurrentUser,
    repository: MeetingRepo,
) -> MeetingControlsResponse:
    meeting = await require_access(meeting_id, current_user, repository)
    if meeting["host_id"] != object_id(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can update meeting controls")
    changes = request.model_dump(exclude_unset=True, exclude_none=True)
    updated = await repository.update_meeting_controls(meeting_id, changes) if changes else meeting
    return controls_response(updated or meeting, object_id(current_user), repository)


@router.get("/{meeting_id}/participants/{user_id}/controls", response_model=ParticipantControlResponse)
async def get_participant_controls(
    meeting_id: str, user_id: str, current_user: CurrentUser, repository: MeetingRepo
) -> ParticipantControlResponse:
    meeting = await require_access(meeting_id, current_user, repository)
    try:
        participant_id = ObjectId(user_id)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found") from error
    participant = next((item for item in await repository.participants(meeting_id) if item.get("user_id") == participant_id), None)
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    if participant_id != object_id(current_user) and meeting["host_id"] != object_id(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can inspect another participant")
    return participant_controls_response(participant, meeting, repository)


@router.patch("/{meeting_id}/participants/{user_id}/controls", response_model=ParticipantControlResponse)
async def update_participant_controls(
    meeting_id: str,
    user_id: str,
    request: UpdateParticipantControlsRequest,
    current_user: CurrentUser,
    repository: MeetingRepo,
    settings: Settings = Depends(get_settings),
) -> ParticipantControlResponse:
    meeting = await require_access(meeting_id, current_user, repository)
    if meeting["host_id"] != object_id(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can update participant controls")
    try:
        participant_id = ObjectId(user_id)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found") from error
    participant = next((item for item in await repository.participants(meeting_id) if item.get("user_id") == participant_id), None)
    if participant is None or participant_id == object_id(current_user):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT if participant_id == object_id(current_user) else status.HTTP_404_NOT_FOUND, detail="Invalid participant control target")
    changes = request.model_dump(exclude_unset=True, exclude_none=True)
    storage_changes = {
        {"chat_allowed": "chat_disabled", "microphone_allowed": "microphone_disabled", "camera_allowed": "camera_disabled", "screen_share_allowed": "screen_share_disabled"}[key]: not value
        for key, value in changes.items()
    }
    if storage_changes:
        await repository.set_participant_control(meeting_id, participant_id, {**storage_changes, "updated_at": datetime.now(timezone.utc)})
        if "microphone_disabled" in storage_changes:
            await set_tracks_muted(f"meeting-{meeting_id}", str(participant_id), "audio", storage_changes["microphone_disabled"], settings)
        if "camera_disabled" in storage_changes:
            await set_tracks_muted(f"meeting-{meeting_id}", str(participant_id), "video", storage_changes["camera_disabled"], settings)
    participant.update(storage_changes)
    return participant_controls_response(participant, meeting, repository)


async def meeting_response(meeting: dict, repository: MeetingRepo, viewer_id: ObjectId) -> MeetingResponse:
    participants = await repository.participants(str(meeting["_id"]))
    is_host = viewer_id == meeting["host_id"]
    meeting_code = meeting.get("meeting_code", "") if is_host else ""
    secure_token = meeting.get("invitation_token") or meeting.get("join_token") or meeting.get("meeting_code") or str(meeting["_id"])
    join_url = meeting.get("join_url", f"/join/{secure_token}") if is_host else ""
    join_password = meeting.get("join_password", "") if is_host else ""
    invited_emails = []
    if is_host:
        for item in participants:
            email = item.get("email")
            if isinstance(email, str) and email.strip():
                invited_emails.append(email.strip().lower())
    return MeetingResponse(
        id=str(meeting["_id"]),
        title=meeting["title"],
        description=meeting["description"],
        scheduled_at=meeting["scheduled_at"],
        duration_minutes=meeting["duration_minutes"],
        status=meeting["status"],
        host_username=meeting["host_username"],
        meeting_code=meeting_code,
        join_url=join_url,
        join_password=join_password,
        invited_emails=list(dict.fromkeys(invited_emails)),
        participants=[
            ParticipantResponse(
                username=item["username"], role=item["role"], invitation_status=item["invitation_status"]
            )
            for item in participants
        ],
    )


@router.post("", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    request: CreateMeetingRequest, current_user: CurrentUser, repository: MeetingRepo, user_repository: UserRepo
) -> MeetingResponse:
    requested_usernames = [username for username in request.participant_usernames if username != current_user["username"]]
    requested_emails = [email for email in request.participant_emails if email != current_user.get("email", "")]

    registered_users_by_username = {user["username"]: user for user in await user_repository.find_by_usernames(requested_usernames)}
    registered_users_by_email = {user["email"].lower(): user for user in await user_repository.find_by_emails(requested_emails)}

    invited_users: list[dict] = []
    seen_user_ids: set[str] = set()
    for user in list(registered_users_by_username.values()) + list(registered_users_by_email.values()):
        user_id = str(user["_id"])
        if user_id in seen_user_ids:
            continue
        seen_user_ids.add(user_id)
        invited_users.append(user)

    registered_usernames = {user["username"] for user in invited_users}
    missing_username = [username for username in requested_usernames if username not in registered_usernames]
    if missing_username:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown participant: {missing_username[0]}")

    now = datetime.now(timezone.utc)
    meeting_code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
    join_password = secrets.token_urlsafe(16)
    invitation_token = generate_invitation_token()
    meeting = {
        "title": request.title,
        "description": request.description,
        "scheduled_at": request.scheduled_at,
        "duration_minutes": request.duration_minutes,
        "status": MeetingStatus.SCHEDULED,
        "host_id": object_id(current_user),
        "host_username": current_user["username"],
        "meeting_code": meeting_code,
        "join_url": f"/join/{invitation_token}",
        "join_password": join_password,
        "invitation_token": invitation_token,
        "invitation_token_hash": hash_invitation_token(invitation_token),
        "created_at": now,
        "updated_at": now,
    }
    participants = [
        {
            "user_id": object_id(current_user),
            "username": current_user["username"],
            "email": current_user.get("email", ""),
            "role": "host",
            "invitation_status": InvitationStatus.ACCEPTED,
            "created_at": now,
        }
    ]
    for user in invited_users:
        participants.append(
            {
                "user_id": user["_id"],
                "username": user["username"],
                "email": user.get("email", ""),
                "role": "participant",
                "invitation_status": InvitationStatus.PENDING,
                "created_at": now,
            }
        )
    normalized_invitee_emails = []
    seen_invitee_emails: set[str] = set()
    for email in requested_emails:
        normalized = email.lower()
        if normalized in seen_invitee_emails:
            continue
        seen_invitee_emails.add(normalized)
        normalized_invitee_emails.append(normalized)

    for email in normalized_invitee_emails:
        if email in {str(item.get("email", "")).lower() for item in participants if isinstance(item.get("email"), str)}:
            continue
        participants.append(
            {
                "username": email.split("@", 1)[0],
                "email": email,
                "role": "participant",
                "invitation_status": InvitationStatus.PENDING,
                "created_at": now,
            }
        )
    created = await repository.create(meeting, participants)
    for user in invited_users:
        await repository.create_notification(user["_id"], created["_id"])
    return await meeting_response(created, repository, object_id(current_user))


@router.get("", response_model=list[MeetingResponse])
async def list_meetings(current_user: CurrentUser, repository: MeetingRepo) -> list[MeetingResponse]:
    meetings = await repository.find_for_user(object_id(current_user), None)
    return [await meeting_response(meeting, repository, object_id(current_user)) for meeting in meetings]


@router.get("/upcoming", response_model=list[MeetingResponse])
async def upcoming_meetings(current_user: CurrentUser, repository: MeetingRepo) -> list[MeetingResponse]:
    meetings = await repository.find_for_user(object_id(current_user), True)
    return [await meeting_response(meeting, repository, object_id(current_user)) for meeting in meetings]


@router.get("/past", response_model=list[MeetingResponse])
async def past_meetings(current_user: CurrentUser, repository: MeetingRepo) -> list[MeetingResponse]:
    meetings = await repository.find_for_user(object_id(current_user), False)
    return [await meeting_response(meeting, repository, object_id(current_user)) for meeting in meetings]


@router.get("/invitations", response_model=list[InvitationResponse])
async def invitations(current_user: CurrentUser, repository: MeetingRepo) -> list[InvitationResponse]:
    results: list[InvitationResponse] = []
    for invitation in await repository.invitations_for_user(object_id(current_user)):
        if invitation.get("role") == "host":
            continue
        meeting = await repository.get(str(invitation["meeting_id"]))
        if meeting is not None:
            results.append(
                InvitationResponse(
                    id=str(invitation["_id"]),
                    meeting_id=str(meeting["_id"]),
                    meeting_title=meeting["title"],
                    host_username=meeting["host_username"],
                    scheduled_at=meeting["scheduled_at"],
                    duration_minutes=meeting["duration_minutes"],
                    invitation_status=invitation["invitation_status"],
                    created_at=invitation["created_at"],
                )
            )
    return results


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(meeting_id: str, current_user: CurrentUser, repository: MeetingRepo) -> MeetingResponse:
    meeting = await require_access(meeting_id, current_user, repository)
    return await meeting_response(meeting, repository, object_id(current_user))


@router.patch("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: str, request: UpdateMeetingRequest, current_user: CurrentUser, repository: MeetingRepo
) -> MeetingResponse:
    meeting = await require_access(meeting_id, current_user, repository)
    if meeting["host_id"] != object_id(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can update this meeting")
    if meeting["status"] == MeetingStatus.CANCELLED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cancelled meetings cannot be updated")
    changes = request.model_dump(exclude_unset=True)
    if not changes:
        return await meeting_response(meeting, repository, object_id(current_user))
    changes["updated_at"] = datetime.now(timezone.utc)
    updated = await repository.update(meeting_id, changes)
    return await meeting_response(updated, repository, object_id(current_user))


@router.post("/{meeting_id}/cancel", response_model=MeetingResponse)
async def cancel_meeting(meeting_id: str, current_user: CurrentUser, repository: MeetingRepo) -> MeetingResponse:
    meeting = await require_access(meeting_id, current_user, repository)
    if meeting["host_id"] != object_id(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can cancel this meeting")
    updated = await repository.cancel(meeting_id)
    return await meeting_response(updated, repository, object_id(current_user))


async def require_join_access(meeting_id: str, current_user: dict, repository: MeetingRepo) -> dict:
    meeting = await repository.get(meeting_id)
    if meeting is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    if meeting["status"] in {MeetingStatus.CANCELLED, MeetingStatus.ENDED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Meeting is not active")
    if meeting["host_id"] != object_id(current_user):
        records = await repository.participants(meeting_id)
        participant = next((item for item in records if item["user_id"] == object_id(current_user)), None)
        if participant is None or participant["invitation_status"] != InvitationStatus.ACCEPTED:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="An accepted invitation is required")
        enforce_join_controls(meeting, participant, records, repository)
    return meeting


@router.post("/join/token", response_model=MeetingAccessResponse)
async def join_meeting_by_token(
    request: InvitationTokenJoinRequest,
    repository: MeetingRepo,
    settings: Settings = Depends(get_settings),
) -> MeetingAccessResponse:
    meeting = await repository.find_by_invitation_token(request.token)
    if meeting is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invitation token")
    if meeting["status"] in {MeetingStatus.CANCELLED, MeetingStatus.ENDED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Meeting is not active")
    participant = await guest_invitation_status_for_email(meeting, request.email, repository)
    if participant is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This invitation does not match the provided email")
    status_value = participant.get("invitation_status")
    if status_value in {InvitationStatus.DECLINED, InvitationStatus.BLOCKED, InvitationStatus.REMOVED}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This invitation is no longer active")
    if status_value in {InvitationStatus.INVITED, InvitationStatus.PENDING}:
        await repository.update_invitation(str(participant["_id"]), InvitationStatus.ACCEPTED)
    enforce_join_controls(meeting, participant, await repository.participants(str(meeting["_id"])), repository)
    meeting_id = str(meeting["_id"])
    user_identity = f"guest-{meeting_id}-{request.email.lower()}"
    try:
        token_value, room_name = create_meeting_token(meeting_id, user_identity, request.full_name, settings)
    except RuntimeError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Video service is not configured") from error
    if meeting["status"] == MeetingStatus.SCHEDULED:
        meeting = await repository.update(meeting_id, {"status": MeetingStatus.LIVE, "updated_at": datetime.now(timezone.utc)})
    return MeetingAccessResponse(
        meeting_id=meeting_id,
        room_name=room_name,
        livekit_url=settings.livekit_url,
        token=token_value,
        is_host=False,
    )


@router.post("/join", response_model=MeetingAccessResponse)
async def join_meeting_by_code(
    request: MeetingJoinRequest,
    current_user: CurrentUser,
    repository: MeetingRepo,
    settings: Settings = Depends(get_settings),
) -> MeetingAccessResponse:
    meeting = await repository.find_by_code(request.meeting_code)
    if meeting is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    if meeting.get("join_password") != request.join_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired meeting password")
    if meeting["status"] in {MeetingStatus.CANCELLED, MeetingStatus.ENDED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Meeting is not active")
    if meeting["host_id"] != object_id(current_user):
        participant = next(
            (item for item in await repository.participants(str(meeting["_id"])) if item["user_id"] == object_id(current_user)),
            None,
        )
        if participant is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not invited to this meeting")
        if participant["invitation_status"] in {InvitationStatus.DECLINED, InvitationStatus.BLOCKED, InvitationStatus.REMOVED}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This invitation is no longer active")
        if participant["invitation_status"] == InvitationStatus.PENDING:
            await repository.update_invitation(str(participant["_id"]), InvitationStatus.ACCEPTED)
            participant["invitation_status"] = InvitationStatus.ACCEPTED
    meeting_id = str(meeting["_id"])
    participant = next(
        (item for item in await repository.participants(meeting_id) if item["user_id"] == object_id(current_user)),
        None,
    )
    enforce_join_controls(meeting, participant, await repository.participants(str(meeting["_id"])), repository)
    publish_sources = allowed_publish_sources(meeting, participant, repository)
    try:
        token, room_name = create_meeting_token(
            meeting_id,
            str(object_id(current_user)),
            current_user["username"],
            settings,
            publish_sources,
        )
    except RuntimeError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Video service is not configured") from error
    if meeting["status"] == MeetingStatus.SCHEDULED:
        meeting = await repository.update(meeting_id, {"status": MeetingStatus.LIVE, "updated_at": datetime.now(timezone.utc)})
    await repository.mark_joined(meeting_id, object_id(current_user))
    return MeetingAccessResponse(
        meeting_id=meeting_id,
        room_name=room_name,
        livekit_url=settings.livekit_url,
        token=token,
        is_host=meeting["host_id"] == object_id(current_user),
    )


@router.post("/{meeting_id}/join", response_model=MeetingAccessResponse)
async def join_meeting(
    meeting_id: str,
    current_user: CurrentUser,
    repository: MeetingRepo,
    settings: Settings = Depends(get_settings),
) -> MeetingAccessResponse:
    meeting = await require_join_access(meeting_id, current_user, repository)
    participant = next(
        (item for item in await repository.participants(meeting_id) if item["user_id"] == object_id(current_user)),
        None,
    )
    publish_sources = allowed_publish_sources(meeting, participant, repository)
    try:
        token, room_name = create_meeting_token(
            meeting_id,
            str(object_id(current_user)),
            current_user["username"],
            settings,
            publish_sources,
        )
    except RuntimeError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Video service is not configured") from error
    if meeting["status"] == MeetingStatus.SCHEDULED:
        meeting = await repository.update(meeting_id, {"status": MeetingStatus.LIVE, "updated_at": datetime.now(timezone.utc)})
    await repository.mark_joined(meeting_id, object_id(current_user))
    return MeetingAccessResponse(
        meeting_id=str(meeting["_id"]),
        room_name=room_name,
        livekit_url=settings.livekit_url,
        token=token,
        is_host=meeting["host_id"] == object_id(current_user),
    )


@router.post("/{meeting_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_meeting(meeting_id: str, current_user: CurrentUser, repository: MeetingRepo) -> None:
    await require_join_access(meeting_id, current_user, repository)
    await repository.mark_left(meeting_id, object_id(current_user))


@router.post("/{meeting_id}/end", response_model=MeetingResponse)
async def end_meeting(
    meeting_id: str,
    current_user: CurrentUser,
    repository: MeetingRepo,
    settings: Settings = Depends(get_settings),
) -> MeetingResponse:
    meeting = await require_access(meeting_id, current_user, repository)
    if meeting["host_id"] != object_id(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can end this meeting")
    updated = await repository.update(meeting_id, {"status": MeetingStatus.ENDED, "updated_at": datetime.now(timezone.utc)})
    room_name = f"meeting-{meeting_id}"
    for participant in await repository.participants(meeting_id):
        if not participant.get("joined_at") or participant.get("left_at"):
            continue
        participant_user_id = participant.get("user_id")
        if participant_user_id is not None:
            if participant_user_id != object_id(current_user):
                await remove_from_room(room_name, str(participant_user_id), settings)
            await repository.mark_left(meeting_id, participant_user_id)
        else:
            email = participant.get("email")
            if isinstance(email, str) and email.strip():
                identity = f"guest-{meeting_id}-{email.strip().lower()}"
                await remove_from_room(room_name, identity, settings)
    return await meeting_response(updated, repository, object_id(current_user))


async def update_invitation(
    invitation_id: str, desired_status: InvitationStatus, current_user: CurrentUser, repository: MeetingRepo
) -> InvitationResponse:
    invitation = await repository.get_invitation(invitation_id)
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    if invitation["user_id"] != object_id(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This invitation belongs to another user")
    if invitation["invitation_status"] != InvitationStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation is no longer pending")
    meeting = await repository.get(str(invitation["meeting_id"]))
    if meeting is None or meeting["status"] == MeetingStatus.CANCELLED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Meeting is no longer available")
    updated = await repository.update_invitation(invitation_id, desired_status)
    return InvitationResponse(
        id=str(updated["_id"]),
        meeting_id=str(meeting["_id"]),
        meeting_title=meeting["title"],
        host_username=meeting["host_username"],
        scheduled_at=meeting["scheduled_at"],
        duration_minutes=meeting["duration_minutes"],
        invitation_status=updated["invitation_status"],
        created_at=updated["created_at"],
    )


@router.post("/invitations/{invitation_id}/accept", response_model=InvitationResponse)
async def accept_invitation(invitation_id: str, current_user: CurrentUser, repository: MeetingRepo) -> InvitationResponse:
    return await update_invitation(invitation_id, InvitationStatus.ACCEPTED, current_user, repository)


@router.post("/invitations/{invitation_id}/decline", response_model=InvitationResponse)
async def decline_invitation(invitation_id: str, current_user: CurrentUser, repository: MeetingRepo) -> InvitationResponse:
    return await update_invitation(invitation_id, InvitationStatus.DECLINED, current_user, repository)
