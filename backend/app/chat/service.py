import json
import logging
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import aiohttp
from livekit.api import room_service
from livekit.protocol.models import DataPacket
from livekit.protocol.room import SendDataRequest

from ..config import Settings

recent_messages: dict[tuple[str, str], deque[datetime]] = defaultdict(deque)
logger = logging.getLogger(__name__)


def enforce_rate_limit(meeting_id: str, user_id: str, settings: Settings) -> None:
    key = (meeting_id, user_id)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=1)
    timestamps = recent_messages[key]
    while timestamps and timestamps[0] < cutoff:
        timestamps.popleft()
    if len(timestamps) >= settings.chat_rate_limit_per_minute:
        raise ValueError("Message rate limit exceeded")
    timestamps.append(datetime.now(timezone.utc))


async def broadcast_message(room_name: str, message: dict, settings: Settings) -> None:
    if not settings.livekit_api_key or not settings.livekit_api_secret or not settings.livekit_url:
        return
    payload = json.dumps(
        {
            "id": str(message["_id"]),
            "meeting_id": str(message["meeting_id"]),
            "username": message["username"],
            "content": message["content"],
            "created_at": message["created_at"].isoformat(),
            "moderation_decision": message.get("moderation_decision", "SAFE"),
        }
    ).encode()
    try:
        async with aiohttp.ClientSession() as session:
            service = room_service.RoomService(
                session, settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret
            )
            await service.send_data(
                SendDataRequest(room=room_name, data=payload, kind=DataPacket.Kind.RELIABLE, topic="meeting-chat")
            )
    except Exception as error:
        logger.warning("LiveKit chat delivery failed (%s); message remains available in history", type(error).__name__)
