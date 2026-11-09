"""Банк призов: число, которое админ ставит вручную; сервер считает его настоящим.

Правила (решение владельца):
- перед каждым розыгрышем сервер смотрит банк: подарок/выигрыш дороже, чем есть в банке, выпасть не может;
- когда в банке мало (или 0), выпадают только два самых дешёвых приза кейса;
- стоимость выпавшего приза списывается из банка в той же транзакции, а строка банка блокируется (`FOR UPDATE`):
  два игрока в одну секунду не получат призы за счёт одних и тех же денег;
- Ракета и Мины: выплата сверх ставки не может быть больше банка; Апгрейд: подарок дороже банка недоступен.
Банк хранится в app_settings (ключ prize_bank). Пока админ его не задал, он равен 0.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import catalog
from app.core.config import get_settings
from app.services.economy_core import pick_weighted

KEY = "prize_bank"
_SQL_ENSURE = "INSERT INTO app_settings (key, value) VALUES (:k, CAST(:v AS jsonb)) ON CONFLICT (key) DO NOTHING"
_SQL_LOCK = "SELECT value FROM app_settings WHERE key = :k FOR UPDATE"
_SQL_SET = "UPDATE app_settings SET value = CAST(:v AS jsonb), updated_at = now() WHERE key = :k"


def enabled() -> bool:
    return get_settings().prize_bank_enabled


def cost_of(item_id: str) -> int:
    """Сколько стоит приз банку: TON-приз — сумма выигрыша, подарок — его цена."""
    if catalog.is_ton_prize(item_id):
        return catalog.ton_prize_minor(item_id)
    return catalog.gift_price(item_id) or 0


async def available(session: AsyncSession) -> int:
    """Сколько в банке сейчас (minor). Блокирует строку банка до конца транзакции — розыгрыши идут по очереди."""
    await session.execute(text(_SQL_ENSURE), {"k": KEY, "v": json.dumps({"minor": 0})})
    raw: Any = (await session.execute(text(_SQL_LOCK), {"k": KEY})).scalar_one()
    data = json.loads(raw) if isinstance(raw, str) else raw
    return max(0, int((data or {}).get("minor", 0)))


async def set_balance(session: AsyncSession, minor: int) -> int:
    """Админ ставит банк вручную."""
    await available(session)
    value = max(0, int(minor))
    await session.execute(text(_SQL_SET), {"k": KEY, "v": json.dumps({"minor": value})})
    await session.commit()
    return value


async def spend(session: AsyncSession, minor: int) -> None:
    """Списать выпавший приз (банк не уходит ниже нуля). Вызывать после `available` в той же транзакции."""
    if minor <= 0:
        return
    cur = await available(session)
    await session.execute(text(_SQL_SET), {"k": KEY, "v": json.dumps({"minor": max(0, cur - int(minor))})})


async def pick(session: AsyncSession, entries: list[tuple[str, int]]) -> str:
    """Выбор приза кейса с учётом банка: дороже банка не выпадает; при пустом банке — два самых дешёвых."""
    if not enabled():
        return pick_weighted(entries)
    bank = await available(session)
    costs = [cost_of(item) for item, _w in entries]
    cheapest = set(sorted(range(len(entries)), key=lambda k: costs[k])[:2])
    allowed = [e for k, e in enumerate(entries) if costs[k] <= bank or k in cheapest]
    prize = pick_weighted(allowed)
    await spend(session, cost_of(prize))
    return prize


async def ensure_can_afford(session: AsyncSession, minor: int) -> bool:
    """Хватает ли банка на приз такой стоимости (для Апгрейда). Без включённого банка — всегда да."""
    if not enabled():
        return True
    return minor <= await available(session)


async def cap_payout(session: AsyncSession, bet: int, payout: int) -> int:
    """Выплата Ракеты/Мин: сверх ставки не больше, чем есть в банке. Прибыль игрока списывается из банка."""
    if not enabled() or payout <= bet:
        return payout
    bank = await available(session)
    capped = min(payout, bet + bank)
    await spend(session, capped - bet)
    return capped
