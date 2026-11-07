"""Игровое API: баланс, инвентарь, кейсы, апгрейд, мины, ракетка, звёзды, задания. Решает сервер."""

from __future__ import annotations

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import _bearer, get_current_user
from app.core.db import get_session
from app.core.security import decode_access_token
from app.models.user import User
from app.services import account_service as acct
from app.services import crash_play, play_service
from app.services.economy_core import balance_minor
from app.services.user_service import get_user_by_id

router = APIRouter(prefix="/api", tags=["play"])

Session = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]
_RID = Field(min_length=1, max_length=64)


class RequestId(BaseModel):
    client_request_id: str = _RID


class UpgradeBody(RequestId):
    item_id: str = Field(min_length=1, max_length=64)
    target_gift_id: str = Field(min_length=1, max_length=64)


class MinesStartBody(RequestId):
    bet_minor: int = Field(ge=1, le=10**9)
    mines_count: int = Field(ge=1, le=24)


class MinesPickBody(BaseModel):
    tile: int = Field(ge=0, le=24)


class CrashBetBody(RequestId):
    amount_minor: Optional[int] = Field(default=None, ge=1, le=10**9)
    item_id: Optional[str] = Field(default=None, max_length=64)
    auto_cashout: Optional[float] = Field(default=None, ge=1.01, le=500)


class ItemBody(BaseModel):
    item_id: str = Field(min_length=1, max_length=64)


class StarsBody(BaseModel):
    stars: int = Field(ge=1, le=10**7)


async def _with_balance(session: AsyncSession, user_id: Any, payload: dict[str, Any]) -> dict[str, Any]:
    return {**payload, "balance_minor": await balance_minor(session, user_id)}


@router.get("/me/state")
async def me_state(user: CurrentUser, session: Session) -> dict[str, Any]:
    return await acct.get_state(session, user)


@router.post("/me/inventory/sell")
async def sell(body: ItemBody, user: CurrentUser, session: Session) -> dict[str, Any]:
    return await acct.sell_item(session, user.id, body.item_id)


@router.post("/me/inventory/withdraw")
async def withdraw(body: ItemBody, user: CurrentUser, session: Session) -> dict[str, Any]:
    return await acct.withdraw_item(session, user.id, body.item_id)


@router.post("/me/stars/exchange")
async def stars_exchange(body: StarsBody, user: CurrentUser, session: Session) -> dict[str, Any]:
    return await acct.exchange_stars(session, user.id, body.stars)


@router.post("/me/bank/claim")
async def bank_claim(user: CurrentUser, session: Session) -> dict[str, Any]:
    """Забрать звёзды за друзей из банка (от 15 ★)."""
    return await acct.claim_bank(session, user.id)


@router.post("/me/quests/{quest_id}/claim")
async def quest_claim(quest_id: str, user: CurrentUser, session: Session) -> dict[str, Any]:
    return await acct.claim_quest(session, user.id, quest_id)


@router.post("/play/cases/{case_id}/open")
async def case_open(case_id: str, body: RequestId, user: CurrentUser, session: Session) -> dict[str, Any]:
    uid = user.id
    result = await play_service.open_case(session, uid, case_id, body.client_request_id)
    return await _with_balance(session, uid, result)


@router.post("/play/free/{case_id}/claim")
async def free_claim(case_id: str, body: RequestId, user: CurrentUser, session: Session) -> dict[str, Any]:
    uid = user.id
    result = await play_service.claim_free(session, uid, case_id, body.client_request_id)
    return await _with_balance(session, uid, result)


@router.get("/play/free/quest")
async def free_quest(user: CurrentUser, session: Session) -> dict[str, Any]:
    uid = user.id
    return await _with_balance(session, uid, await play_service.quest_status(session, uid))


@router.post("/play/upgrade")
async def upgrade(body: UpgradeBody, user: CurrentUser, session: Session) -> dict[str, Any]:
    uid = user.id
    result = await play_service.upgrade(session, uid, body.item_id, body.target_gift_id, body.client_request_id)
    return await _with_balance(session, uid, result)


@router.post("/play/mines/start")
async def mines_start(body: MinesStartBody, user: CurrentUser, session: Session) -> dict[str, Any]:
    uid = user.id
    result = await play_service.mines_start(session, uid, body.bet_minor, body.mines_count, body.client_request_id)
    return await _with_balance(session, uid, result)


@router.get("/play/mines/active")
async def mines_active(user: CurrentUser, session: Session) -> dict[str, Any]:
    return {"round": await play_service.mines_active(session, user.id)}


@router.post("/play/mines/{round_id}/pick")
async def mines_pick(round_id: str, body: MinesPickBody, user: CurrentUser, session: Session) -> dict[str, Any]:
    uid = user.id
    return await _with_balance(session, uid, await play_service.mines_pick(session, uid, round_id, body.tile))


@router.post("/play/mines/{round_id}/cashout")
async def mines_cashout(round_id: str, user: CurrentUser, session: Session) -> dict[str, Any]:
    uid = user.id
    return await _with_balance(session, uid, await play_service.mines_cashout(session, uid, round_id))


async def _optional_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(_bearer)], session: Session
) -> User | None:
    if credentials is None or not credentials.credentials:
        return None
    try:
        import uuid

        payload = decode_access_token(credentials.credentials)
        return await get_user_by_id(session, uuid.UUID(str(payload.get("sub"))))
    except Exception:  # noqa: BLE001
        return None


@router.get("/play/crash/state")
async def crash_state(
    session: Session,
    user: Annotated[Optional[User], Depends(_optional_user)],
    me: Annotated[int, Query(ge=0, le=1)] = 0,
) -> dict[str, Any]:
    """Расписание раундов. С me=1 (и токеном) дополнительно закрывает ставки игрока и отдаёт ставку и баланс."""
    return await crash_play.state(session, user.id if (user and me) else None)


@router.post("/play/crash/bet")
async def crash_bet(body: CrashBetBody, user: CurrentUser, session: Session) -> dict[str, Any]:
    uid = user.id
    result = await crash_play.place_bet(
        session,
        uid,
        amount_minor=body.amount_minor,
        item_id=body.item_id,
        request_id=body.client_request_id,
        auto_cashout=body.auto_cashout,
    )
    return await _with_balance(session, uid, result)


@router.post("/play/crash/cashout")
async def crash_cashout(user: CurrentUser, session: Session) -> dict[str, Any]:
    uid = user.id
    return await _with_balance(session, uid, await crash_play.cashout(session, uid))
