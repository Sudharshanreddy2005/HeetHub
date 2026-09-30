from datetime import timedelta
from typing import Sequence

from livekit import api

from ..config import Settings


def create_meeting_token(
    meeting_id: str,
    user_id: str,
    username: str,
    settings: Settings,
    can_publish_sources: Sequence[str] | None = None,
) -> tuple[str, str]:
    if not settings.livekit_api_key or not settings.livekit_api_secret or not settings.livekit_url:
        raise RuntimeError("LiveKit is not configured")

    room_name = f"meeting-{meeting_id}"
    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_ttl(timedelta(minutes=settings.livekit_token_ttl_minutes))
        .with_identity(user_id)
        .with_name(username)
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
                can_publish_sources=list(can_publish_sources) if can_publish_sources is not None else None,
            )
        )
        .to_jwt()
    )
    return token, room_name
