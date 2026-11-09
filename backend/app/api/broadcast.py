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
from app.services import admin_players, stats_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


class BroadcastBody(BaseModel):
    text: str = Field(min_length=1, max_length=svc.MAX_TEXT)
    audience: str = "all"
    test: bool = False
    open_app: bool = False
    button_text: str | None = Field(default=None, max_length=40)
    button_url: str | None = Field(default=None, max_length=300)
    preset: str | None = None  # готовый пост с картинкой (см. broadcast_service.PRESETS)


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
        "presets": [{"id": k, "label": v["label"], "button": v["button"], "text": svc.preset_text(k)} for k, v in svc.PRESETS.items()],
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
    if body.preset is not None:
        if body.preset not in svc.PRESETS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неизвестный готовый пост")
        if len(body.text) > svc.CAPTION_MAX:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Подпись к картинке — не больше {svc.CAPTION_MAX} символов")
    args = (body.button_text, body.button_url, body.open_app)
    if body.test:
        ok, err = await svc.send_test(int(user["id"]), body.text, args, body.preset)
        if not ok:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Не отправилось: {err or 'ошибка Telegram'}")
        return {"ok": True, "test": True}
    if svc.is_running():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Предыдущая рассылка ещё идёт")
    return {"ok": True, "total": svc.start(body.audience, await svc.audience_ids(session, body.audience), body.text, args, body.preset)}


@router.get("/players")
async def players(
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
    q: str = "",
    sort: str = "last",
    limit: int = 100,
) -> dict[str, Any]:
    """Игроки для админки: поиск по имени/@/ID, сортировка (last, new, wagered, deposited, balance)."""
    _admin(x_telegram_init_data)
    return await admin_players.players_list(session, q[:64], sort, limit)


@router.get("/locked-gifts")
async def locked_gifts(
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> list[dict[str, Any]]:
    """NFT под замком (задание: 5 друзей, пополнение, игры): у кого, какой, сколько стоит, прогресс."""
    _admin(x_telegram_init_data)
    return await admin_players.locked_gifts_list(session)


@router.get("/players/{telegram_id}")
async def player_card(
    telegram_id: int,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Карточка игрока: профиль, деньги, игры, кейсы, подарки, друзья, история операций."""
    _admin(x_telegram_init_data)
    detail = await admin_players.player_detail(session, telegram_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Игрок не найден")
    return detail


class ResetBody(BaseModel):
    confirm: str


@router.post("/reset-balances")
async def reset_balances(
    body: ResetBody,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Обнуляет TON-баланс всем игрокам, кроме админов. Нужна фраза подтверждения «ОБНУЛИТЬ»."""
    _admin(x_telegram_init_data)
    if body.confirm.strip().upper() != "ОБНУЛИТЬ":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нужно подтверждение: ОБНУЛИТЬ")
    from app.services import account_service

    return await account_service.reset_balances(session, set(ADMIN_USERNAMES))


@router.post("/reset-profit")
async def reset_profit(
    body: ResetBody,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Обнулить прибыль в админке: игры, кейсы и прибыль казино считаются с этого момента. Фраза «СБРОС»."""
    _admin(x_telegram_init_data)
    if body.confirm.strip().upper() != "СБРОС":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нужно подтверждение: СБРОС")
    from app.services.app_settings import reset_profit_now

    at = await reset_profit_now(session)
    return {"ok": True, "profit_since": int(at.timestamp())}
