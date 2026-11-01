from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import validate_telegram_init_data
from app.services import referral_service

router = APIRouter(prefix="/api/referrals", tags=["referrals"])


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


@router.post("/join")
async def join(payload: JoinRequest) -> dict[str, bool]:
    return {"registered": referral_service.join(_user(payload.init_data), payload.inviter_id)}


@router.post("/qualify")
async def qualify(payload: InitRequest) -> dict[str, bool]:
    return {"qualified": referral_service.qualify(_user(payload.init_data))}


@router.post("/mine")
async def mine(payload: InitRequest) -> dict[str, Any]:
    """Друзья текущего игрока: для каждого — Premium и открыл ли он бесплатный кейс."""
    user = _user(payload.init_data)
    return {"friends": referral_service.friends_of(int(user["id"]))}
