from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session

from app.api.odds import ADMIN_USERNAMES
from app.core.config import get_settings
from app.core.security import validate_telegram_init_data
from app.services import broadcast_service as svc
from app.services import stats_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


class BroadcastBody(BaseModel):
    text: str = Field(min_length=1, max_length=svc.MAX_TEXT)
    audience: str = "all"
    test: bool = False
    open_app: bool = False
    button_text: str | None = Field(default=None, max_length=40)
    button_url: str | None = Field(default=None, max_length=300)


def _admin(init_data: str | None) -> dict[str, Any]:
    if not init_data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нужен запуск из Telegram")
    try:
        user = validate_telegram_init_data(init_data).get("user") or {}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if str(user.get("username") or "").lower().lstrip("@") not in ADMIN_USERNAMES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")
    return user


@router.get("/broadcast")
async def broadcast_info(
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    _admin(x_telegram_init_data)
    counts = await svc.audience_counts(session)
    return {
        "audiences": [{"id": k, "label": v, "count": counts[k]} for k, v in svc.AUDIENCES.items()],
        "status": svc.status(),
    }


@router.post("/broadcast")
async def broadcast_send(
    body: BroadcastBody,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    user = _admin(x_telegram_init_data)
    if not get_settings().bot_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Токен бота не задан на сервере")
    if body.audience not in svc.AUDIENCES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неизвестная аудитория")
    if body.button_url and not body.button_url.startswith(("https://", "http://", "tg://")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ссылка кнопки должна начинаться с https://")
    args = (body.button_text, body.button_url, body.open_app)
    if body.test:
        ok, err = await svc.send_test(int(user["id"]), body.text, args)
        if not ok:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Не отправилось: {err or 'ошибка Telegram'}")
        return {"ok": True, "test": True}
    if svc.is_running():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Предыдущая рассылка ещё идёт")
    return {"ok": True, "total": svc.start(body.audience, await svc.audience_ids(session, body.audience), body.text, args)}


@router.get("/players")
async def players(
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Последние активные игроки (имя, оборот, результат) для списка в админке."""
    _admin(x_telegram_init_data)
    rows = sorted((await stats_service.users_snapshot(session)).items(), key=lambda kv: kv[1].get("last", 0), reverse=True)
    return [
        {
            "id": k,
            "name": v.get("name"),
            "first": v.get("first"),
            "last": v.get("last"),
            "wagered": v.get("wagered", 0),
            "delta": v.get("delta", 0),
            "events": v.get("events", 0),
        }
        for k, v in rows[: min(max(limit, 1), 200)]
    ]
