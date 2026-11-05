from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.odds import ADMIN_USERNAMES
from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import create_access_token, validate_telegram_init_data
from app.models.economy import UserMeta
from app.models.user import User
from app.services.economy_core import ensure_account
from app.services.telegram_bot import notify_admins_new_user
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

    start_param = str((validated.get("raw_params") or {}).get("start_param") or "")
    user = await get_or_create_telegram_user(
        session,
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
        last_name=last_name,
        photo_url=photo_url,
        referral_code=payload.referral_code or (start_param if start_param.startswith("ref-") else None),
    )
    await ensure_account(session, user.id)
    meta = await session.get(UserMeta, user.id)
    if meta is not None and bool(user_info.get("is_premium")) and not meta.is_premium:
        meta.is_premium = True
    await session.commit()

    if getattr(user, "just_registered", False):
        await _schedule_new_user_notice(session, user)

    token = create_access_token(user.id, user.telegram_id)
    return AuthResponse(
        token=token,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


async def _schedule_new_user_notice(session: AsyncSession, user: User) -> None:
    """Уведомляет админов в боте о новом игроке (в фоне, ответ авторизации не задерживается)."""
    try:
        ids = {int(x) for x in get_settings().admin_notify_chat_ids.split(",") if x.strip().lstrip("-").isdigit()}
        rows = await session.execute(
            select(User.telegram_id).where(func.lower(User.username).in_(ADMIN_USERNAMES))
        )
        ids.update(int(r[0]) for r in rows.all())
        total = int((await session.execute(select(func.count()).select_from(User))).scalar_one())
        referrer = None
        if user.referred_by_id is not None:
            ref = await session.get(User, user.referred_by_id)
            if ref is not None:
                referrer = f"@{ref.username}" if ref.username else str(ref.telegram_id)
        asyncio.create_task(
            notify_admins_new_user(
                sorted(ids),
                telegram_id=user.telegram_id,
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                total_users=total,
                referrer=referrer,
            )
        )
    except Exception:  # noqa: BLE001 — уведомление не должно ломать вход
        pass


@router.post("/auth/dev", response_model=AuthResponse)
async def auth_dev(
    payload: DevAuthRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AuthResponse:
    settings = get_settings()
    if settings.app_env not in ("development", "test"):
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
