from __future__ import annotations

from typing import Annotated, Any, Literal, Union

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import validate_telegram_init_data
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models.user import User
from app.services import account_service, stats_service

router = APIRouter(prefix="/api", tags=["stats"])

ADMIN_USERNAMES = {"zapixxgarant", "qwedgpo"}
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
    """Устарело: сервер сам ведёт учёт игр и пополнений. Принимаем и игнорируем (старые версии приложения)."""
    return None


@router.get("/leaderboard")
async def leaderboard(
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Публичный рейтинг игроков по обороту. С initData дополнительно помечает строку игрока."""
    my_id = None
    if x_telegram_init_data:
        try:
            tg = int(_user(x_telegram_init_data)["id"])
            my_id = (await session.execute(select(User.id).where(User.telegram_id == tg))).scalar_one_or_none()
        except HTTPException:
            my_id = None
    return await account_service.leaderboard(session, my_id)


@router.get("/admin/stats")
async def admin_stats(
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Сводная статистика проекта; только для админа (по подписанному initData)."""
    if not x_telegram_init_data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нужен запуск из Telegram")
    user = _user(x_telegram_init_data)
    name = str(user.get("username") or "").lower().lstrip("@")
    if name not in ADMIN_USERNAMES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")
    from app.services import admin_players

    return {**await stats_service.snapshot(session), **await admin_players.overview_extra(session)}


def _require_admin(init_data: str | None) -> None:
    if not init_data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нужен запуск из Telegram")
    name = str(_user(init_data).get("username") or "").lower().lstrip("@")
    if name not in ADMIN_USERNAMES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")


@router.get("/admin/clicker/suspicious")
async def admin_clicker_suspicious(
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Подозрительные на автокликер игроки Кликалки (только админ)."""
    _require_admin(x_telegram_init_data)
    from app.services import clicker

    return {"threshold": clicker.SUS_THRESHOLD, "players": (await clicker.suspicious(session))[:50]}


@router.get("/admin/stars-purchases")
async def admin_stars_purchases(
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Покупки за Telegram Stars отдельно от TON: итог и последние 30 (только админ)."""
    _require_admin(x_telegram_init_data)
    from sqlalchemy import desc, func, select

    from app.models.economy import DepositOrder
    from app.models.user import User

    stars_per_ton = 100
    base = (DepositOrder.provider == "stars", DepositOrder.status == "paid")
    cnt, minor = (
        await session.execute(select(func.count(), func.coalesce(func.sum(DepositOrder.amount_minor), 0)).where(*base))
    ).one()
    rows = (
        await session.execute(
            select(DepositOrder.amount_minor, DepositOrder.paid_at, User.first_name, User.username)
            .join(User, User.id == DepositOrder.user_id)
            .where(*base)
            .order_by(desc(DepositOrder.paid_at))
            .limit(30)
        )
    ).all()
    return {
        "count": int(cnt),
        "stars_total": round(int(minor) * stars_per_ton / 1000),
        "ton_equivalent_minor": int(minor),
        "recent": [
            {
                "name": (fn or "Игрок")[:30], "username": un, "stars": round(int(m) * stars_per_ton / 1000), "ton_minor": int(m),
                "paid_at": int(pa.timestamp()) if pa else 0,
            }
            for m, pa, fn, un in rows
        ],
    }


@router.get("/admin/clicker/players")
async def admin_clicker_players(
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Кто сколько накликал, бонусы за рефералов и подозрение на автокликер (только админ)."""
    _require_admin(x_telegram_init_data)
    from app.services import clicker

    return {"threshold": clicker.SUS_THRESHOLD, "players": await clicker.players_overview(session)}


class PrizeBankBody(BaseModel):
    ton: float = Field(ge=0, le=10_000_000)


@router.get("/admin/prize-bank")
async def admin_prize_bank(
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Сколько сейчас в банке призов (только админ)."""
    _require_admin(x_telegram_init_data)
    from app.services import prize_bank

    minor = await prize_bank.available(session)
    await session.commit()
    return {"minor": minor, "enabled": prize_bank.enabled()}


@router.post("/admin/prize-bank")
async def admin_prize_bank_set(
    body: PrizeBankBody,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Поставить банк призов вручную (TON). Сервер сразу считает его настоящим (только админ)."""
    _require_admin(x_telegram_init_data)
    from app.services import prize_bank

    return {"minor": await prize_bank.set_balance(session, round(body.ton * 1000))}


class MarkupBody(BaseModel):
    markup_pct: float = Field(ge=0, le=100)


@router.get("/admin/market-prices")
async def admin_market_prices(x_telegram_init_data: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    """Состояние автообновления цен подарков по рынку (только админ)."""
    _require_admin(x_telegram_init_data)
    from app.services import market_prices

    return await market_prices.status()


@router.post("/admin/market-prices/markup")
async def admin_market_markup(
    body: MarkupBody,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Наценка на цену маркета, % (страховка сверху). Цены пересчитываются сразу (только админ)."""
    _require_admin(x_telegram_init_data)
    from app.services import market_prices

    await market_prices.load(session)
    await market_prices.set_markup(session, body.markup_pct)
    return await market_prices.status()


@router.post("/admin/market-prices/refresh")
async def admin_market_refresh(x_telegram_init_data: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    """«Проверить и поставить по цене»: забрать актуальные флоры сейчас и применить цены (только админ)."""
    _require_admin(x_telegram_init_data)
    from app.services import market_prices

    await market_prices.load()
    report = await market_prices.refresh(trigger="admin")
    return {"report": report, **await market_prices.status()}
