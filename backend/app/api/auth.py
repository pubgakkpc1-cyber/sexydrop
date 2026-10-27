from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import create_access_token, validate_telegram_init_data
from app.models.user import User
from app.schemas.auth import AuthResponse, DevAuthRequest, TelegramAuthRequest
from app.schemas.user import UserRead
from app.services.user_service import get_or_create_telegram_user

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/auth/telegram", response_model=AuthResponse)
async def auth_telegram(
    payload: TelegramAuthRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AuthResponse:
    try:
        validated = validate_telegram_init_data(payload.init_data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    user_info = validated.get("user")
    if not user_info or "id" not in user_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram initData did not contain user identity",
        )

    telegram_id = int(user_info["id"])
    username = user_info.get("username")
    first_name = user_info.get("first_name")
    last_name = user_info.get("last_name")
    photo_url = user_info.get("photo_url")

    user = await get_or_create_telegram_user(
        session,
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
        last_name=last_name,
        photo_url=photo_url,
        referral_code=payload.referral_code,
    )

    token = create_access_token(user.id, user.telegram_id)
    return AuthResponse(
        token=token,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.post("/auth/dev", response_model=AuthResponse)
async def auth_dev(
    payload: DevAuthRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AuthResponse:
    settings = get_settings()
    if settings.app_env == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev authentication endpoint is disabled in production",
        )

    user = await get_or_create_telegram_user(
        session,
        telegram_id=payload.telegram_id,
        username=payload.username,
        first_name=payload.first_name,
        last_name=payload.last_name,
        photo_url=payload.photo_url,
        referral_code=payload.referral_code,
    )

    token = create_access_token(user.id, user.telegram_id)
    return AuthResponse(
        token=token,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.get("/users/me", response_model=UserRead)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserRead:
    return UserRead.model_validate(current_user)
