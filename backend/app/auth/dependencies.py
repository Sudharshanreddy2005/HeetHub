from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..config import Settings, get_settings
from ..database import MongoConnection
from .repository import UserRepository
from .security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_database() -> MongoConnection:
    from ..main import database

    return database


def get_user_repository(database: Annotated[MongoConnection, Depends(get_database)]) -> UserRepository:
    return UserRepository(database)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
    repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    user_id = decode_access_token(credentials.credentials, settings)
    user = await repository.find_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    return user
