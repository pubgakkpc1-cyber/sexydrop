from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import validate_telegram_init_data
from app.models.user import User
from app.services import account_service

router = APIRouter(prefix="/api/referrals", tags=["referrals"])
Session = Annotated[AsyncSession, Depends(get_session)]


class InitRequest(BaseModel):
    init_data: str = Field(min_length=1, max_length=8192)


class JoinRequest(InitRequest):
    inviter_id: int = Field(ge=1, le=10**15)


def _user(init_data: str) -> dict[str, Any]:
    try:
        validated = validate_telegram_init_data(init_data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = validated.get("user") or {}
    if "id" not in user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет данных пользователя")
    return user


async def _db_user(session: AsyncSession, tg: dict[str, Any]) -> User | None:
    return (await session.execute(select(User).where(User.telegram_id == int(tg["id"])))).scalar_one_or_none()


@router.post("/join")
async def join(payload: JoinRequest, session: Session) -> dict[str, bool]:
    tg = _user(payload.init_data)
    user = await _db_user(session, tg)
    if user is None:
        return {"registered": False}
    return {"registered": await account_service.join_referral(session, user, payload.inviter_id, bool(tg.get("is_premium")))}


@router.post("/qualify")
async def qualify(payload: InitRequest) -> dict[str, bool]:
    """Устарело: сервер сам видит, что друг открыл бесплатный кейс."""
    _user(payload.init_data)
    return {"qualified": True}


class ShareRequest(InitRequest):
    kind: str = Field(min_length=1, max_length=16)


@router.post("/share")
async def share(payload: ShareRequest) -> dict[str, Any]:
    """Готовит сообщение «гифка + подпись со ссылкой» для WebApp.shareMessage (своё для каждого места)."""
    from app.services import ref_share

    tg = _user(payload.init_data)
    if payload.kind not in ref_share.KINDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неизвестная гифка")
    prepared = await ref_share.prepare_share(int(tg["id"]), payload.kind)
    if not prepared:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Не удалось подготовить сообщение")
    return {"id": prepared}


@router.post("/mine")
async def mine(payload: InitRequest, session: Session) -> dict[str, Any]:
    """Друзья текущего игрока: для каждого — Premium и открыл ли он бесплатный кейс."""
    user = await _db_user(session, _user(payload.init_data))
    return {"friends": await account_service.friends_of(session, user.id) if user else []}
