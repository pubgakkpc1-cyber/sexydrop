from __future__ import annotations

from typing import Annotated, Any, Literal, Union

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import validate_telegram_init_data
from app.services import stats_service

router = APIRouter(prefix="/api", tags=["stats"])

ADMIN_USERNAMES = {"zapixxgarant"}
_MINOR = Field(ge=-10_000_000_000, le=10_000_000_000)
_POS = Field(ge=0, le=10_000_000_000)


class GameEvent(BaseModel):
    type: Literal["game"]
    game: str = Field(min_length=1, max_length=32)
    stake: int = _POS
    delta: int = _MINOR


class CaseEvent(BaseModel):
    type: Literal["case"]
    case: str = Field(min_length=1, max_length=32)
    price: int = _POS
    prize: int = _POS


class DepositEvent(BaseModel):
    type: Literal["deposit"]
    method: Literal["ton", "crypto", "stars", "demo"]
    amount: int = _POS


class OpenEvent(BaseModel):
    type: Literal["open"]


class EventRequest(BaseModel):
    init_data: str = Field(min_length=1, max_length=8192)
    event: Union[GameEvent, CaseEvent, DepositEvent, OpenEvent] = Field(discriminator="type")


def _user(init_data: str) -> dict[str, Any]:
    try:
        validated = validate_telegram_init_data(init_data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = validated.get("user") or {}
    if "id" not in user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет данных пользователя")
    return user


@router.post("/events", status_code=status.HTTP_204_NO_CONTENT)
async def post_event(payload: EventRequest) -> None:
    """Событие игрока для статистики. Личность — из подписанного initData."""
    stats_service.record(_user(payload.init_data), payload.event.model_dump())


@router.get("/admin/stats")
async def admin_stats(
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Сводная статистика проекта; только для админа (по подписанному initData)."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нужен запуск из Telegram")
    user = _user(x_telegram_init_data)
    name = str(user.get("username") or "").lower().lstrip("@")
    if name not in ADMIN_USERNAMES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")
    return stats_service.snapshot()
