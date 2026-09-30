"""Server-side LiveKit enforcement for host moderation controls.

No media is recorded or relayed by this module. It only calls LiveKit's room
administration API for participants already connected to a private room.
"""

import logging

import aiohttp
from livekit.api import room_service
from livekit.protocol.models import TrackType
from livekit.protocol.room import MuteRoomTrackRequest, RoomParticipantIdentity

from ..config import Settings

logger = logging.getLogger(__name__)


def is_configured(settings: Settings) -> bool:
    return bool(settings.livekit_api_key and settings.livekit_api_secret and settings.livekit_url)


async def set_microphone_muted(room_name: str, identity: str, muted: bool, settings: Settings) -> None:
    await set_tracks_muted(room_name, identity, "audio", muted, settings)


async def set_tracks_muted(room_name: str, identity: str, media_type: str, muted: bool, settings: Settings) -> None:
    """Mute active microphone tracks, if the participant is currently connected.

    A missing or disconnected participant is not an error: the persisted
    participant control and join-token restriction cover a later connection.
    """
    if not is_configured(settings):
        return
    try:
        async with aiohttp.ClientSession() as session:
            service = room_service.RoomService(
                session, settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret
            )
            participant = await service.get_participant(RoomParticipantIdentity(room=room_name, identity=identity))
            for track in participant.tracks:
                expected_type = TrackType.AUDIO if media_type == "audio" else TrackType.VIDEO
                if track.type == expected_type:
                    await service.mute_published_track(
                        MuteRoomTrackRequest(room=room_name, identity=identity, track_sid=track.sid, muted=muted)
                    )
    except Exception as error:
        # Persistence and subsequent token checks remain authoritative. Do not
        # disclose provider details or participant metadata in client errors.
        logger.warning("Unable to update LiveKit microphone state (%s)", type(error).__name__)


async def remove_from_room(room_name: str, identity: str, settings: Settings) -> None:
    """Disconnect an active participant after REMOVE or BLOCK is persisted."""
    if not is_configured(settings):
        return
    try:
        async with aiohttp.ClientSession() as session:
            service = room_service.RoomService(
                session, settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret
            )
            await service.remove_participant(RoomParticipantIdentity(room=room_name, identity=identity))
    except Exception as error:
        logger.warning("Unable to remove participant from LiveKit room (%s)", type(error).__name__)
