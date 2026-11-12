"""Сверка оплат Stars с Telegram: ни одна оплата не теряется, даже если уведомление до сервера не дошло или зачисление упало.

Бот видит свои поступления через getStarTransactions. Для каждого входящего платежа с нашим payload («sd-stars-…»):
- заказ есть и уже оплачен — пропуск;
- заказ есть, но не оплачен — зачисляем TON по курсу;
- заказа нет — находим игрока по Telegram ID плательщика, создаём заказ и зачисляем.
Повторный запуск безопасен: один payload — одно зачисление.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx
from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import get_session_factory
from app.models.economy import DepositOrder
from app.models.user import User

log = logging.getLogger(__name__)

PAYLOAD_PREFIX = "sd-stars-"
PAGE = 100
MAX_PAGES = 10
_lock = asyncio.Lock()
_last_run = 0.0


async def _fetch_transactions() -> list[dict[str, Any]]:
    token = get_settings().bot_token
    if not token:
        return []
    out: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        for page in range(MAX_PAGES):
            res = await client.post(
                f"https://api.telegram.org/bot{token}/getStarTransactions", json={"offset": page * PAGE, "limit": PAGE}
            )
            body = res.json()
            if not body.get("ok"):
                log.warning("getStarTransactions failed: %s", body.get("description"))
                break
            batch = (body.get("result") or {}).get("transactions") or []
            out.extend(batch)
            if len(batch) < PAGE:
                break
    return out


async def reconcile(*, min_interval_s: float = 0.0) -> int:
    """Сверяет оплаты и зачисляет пропущенные. Возвращает, сколько оплат зачислено."""
    global _last_run
    if get_settings().app_env == "test" and not _force_in_test:
        return 0
    async with _lock:
        if time.monotonic() - _last_run < min_interval_s:
            return 0
        _last_run = time.monotonic()
        try:
            txs = await _fetch_transactions()
        except Exception as exc:  # noqa: BLE001
            log.warning("stars reconcile: telegram unavailable: %s", exc)
            return 0
        credited = 0
        from app.services import account_service, deposit_service

        for tx in txs:
            src = tx.get("source") or {}
            payload = str(src.get("invoice_payload") or "")
            user = src.get("user") or {}
            stars, charge = tx.get("amount"), str(tx.get("id") or "")
            if src.get("type") != "user" or not payload.startswith(PAYLOAD_PREFIX) or not isinstance(stars, int) or stars <= 0 or not charge:
                continue
            try:
                async with get_session_factory()() as session:
                    order = (
                        await session.execute(
                            select(DepositOrder).where(DepositOrder.provider == "stars", DepositOrder.secret == payload)
                        )
                    ).scalar_one_or_none()
                    if order is not None and order.status == "paid":
                        continue
                    if order is None:
                        owner = (
                            await session.execute(select(User).where(User.telegram_id == user.get("id")))
                        ).scalar_one_or_none()
                        if owner is None:
                            log.warning("stars payment %s: player %s not found", charge[:10], user.get("id"))
                            continue
                        order = await account_service.create_deposit_order(
                            session, owner.id, "stars", payload, deposit_service.stars_to_minor(stars)
                        )
                    await account_service.credit_deposit(session, order.id, deposit_service.stars_to_minor(stars), charge)
                    credited += 1
                    log.warning("stars payment recovered: %s stars (tx %s)", stars, charge[:10])
            except Exception:  # noqa: BLE001
                log.exception("stars reconcile: credit failed for tx %s", charge[:10])
        return credited


_force_in_test = False


async def loop() -> None:
    """Фоновая сверка: через полминуты после запуска и дальше каждые 3 минуты."""
    await asyncio.sleep(30)
    while True:
        try:
            await reconcile()
        except Exception:  # noqa: BLE001
            log.exception("stars reconcile loop")
        await asyncio.sleep(180)
