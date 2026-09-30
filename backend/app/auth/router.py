import logging

from fastapi import APIRouter, Depends, HTTPException, status

from ..config import Settings, get_settings
from .dependencies import get_current_user, get_user_repository
from .models import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from .repository import UserRepository
from .security import create_access_token, hash_password, verify_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def to_user_response(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        username=user["username"],
        email=user["email"],
        full_name=user.get("full_name", user["username"]),
        phone=user.get("phone", ""),
        role=user["role"],
        created_at=user["created_at"],
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    repository: UserRepository = Depends(get_user_repository),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    if not settings.jwt_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication is not configured")
    if await repository.find_by_email(str(request.email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with that email already exists")
    try:
        user = await repository.create(
            request.username,
            str(request.email),
            hash_password(request.password),
            full_name=request.full_name,
            phone=request.phone,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    logger.info("User account registered: %s", user["_id"])
    return AuthResponse(access_token=create_access_token(str(user["_id"]), settings), user=to_user_response(user))


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    repository: UserRepository = Depends(get_user_repository),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    if not settings.jwt_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication is not configured")
    user = await repository.find_by_email(str(request.email))
    if user is None or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return AuthResponse(access_token=create_access_token(str(user["_id"]), settings), user=to_user_response(user))


@router.get("/me", response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)) -> UserResponse:
    return to_user_response(current_user)
