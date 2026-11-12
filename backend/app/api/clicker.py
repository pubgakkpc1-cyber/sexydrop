from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_session
from app.models.user import User
from app.services import clicker

router = APIRouter(prefix="/api/clicker", tags=["clicker"])
Session = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


class TapBody(BaseModel):
    taps: int = Field(ge=0, le=1000)


class BoostBody(BaseModel):
    level: int = Field(ge=2, le=3)
    currency: str = Field(pattern="^(stars|ton)$")


@router.post("/boost")
async def clicker_boost(body: BoostBody, user: CurrentUser, session: Session) -> dict[str, Any]:
    """Купить усиление тапа (x2 / x3) на сезон за звёзды или TON."""
    res = await clicker.buy_boost(session, user, body.level, body.currency)
    from app.services.economy_core import balance_minor

    return {**res, "balance_minor": await balance_minor(session, user.id)}


@router.get("/state")
async def clicker_state(user: CurrentUser, session: Session) -> dict[str, Any]:
    """Мои клики, недельный топ-20 и моё место."""
    return await clicker.state(session, user)


@router.post("/tap")
async def clicker_tap(body: TapBody, user: CurrentUser, session: Session) -> dict[str, Any]:
    """Засчитать пачку тапов (сервер режет всё быстрее MAX_CPS в секунду)."""
    return await clicker.tap(session, user, body.taps)
