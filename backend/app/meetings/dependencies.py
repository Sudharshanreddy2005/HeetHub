from typing import Annotated

from fastapi import Depends

from ..auth.dependencies import get_current_user, get_database, get_user_repository
from ..auth.repository import UserRepository
from ..database import MongoConnection
from .repository import MeetingRepository


def get_meeting_repository(
    database: Annotated[MongoConnection, Depends(get_database)],
) -> MeetingRepository:
    return MeetingRepository(database)


CurrentUser = Annotated[dict, Depends(get_current_user)]
MeetingRepo = Annotated[MeetingRepository, Depends(get_meeting_repository)]
UserRepo = Annotated[UserRepository, Depends(get_user_repository)]