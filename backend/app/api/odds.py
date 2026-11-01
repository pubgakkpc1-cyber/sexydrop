from __future__ import annotations

import re
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import validate_telegram_init_data
from app.services import odds_service

router = APIRouter(prefix="/api", tags=["odds"])

ADMIN_USERNAMES = {"zapixxgarant"}
_CASE_ID = re.compile(r"^[a-z0-9_-]{1,32}$")


class OddsBody(BaseModel):
    weights: dict[str, int] = Field(min_length=1, max_length=odds_service.MAX_ITEMS)


def _require_admin(init_data: str | None) -> None:
    if not init_data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нужен запуск из Telegram")
    try:
        user = validate_telegram_init_data(init_data).get("user") or {}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if str(user.get("username") or "").lower().lstrip("@") not in ADMIN_USERNAMES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")


def _check_case(case_id: str) -> None:
    if not _CASE_ID.match(case_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный кейс")


@router.get("/odds")
async def get_odds() -> dict[str, dict[str, int]]:
    """Шансы, выставленные админом (веса призов по кейсам). Пусто — действуют дефолтные."""
    return odds_service.get_all()


@router.put("/admin/odds/{case_id}")
async def put_odds(
    case_id: str,
    body: OddsBody,
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, bool]:
    _require_admin(x_telegram_init_data)
    _check_case(case_id)
    try:
        odds_service.set_case(case_id, body.weights)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"ok": True}


@router.delete("/admin/odds/{case_id}")
async def delete_odds(
    case_id: str,
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, bool]:
    _require_admin(x_telegram_init_data)
    _check_case(case_id)
    odds_service.reset_case(case_id)
    return {"ok": True}
