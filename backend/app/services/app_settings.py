"""Настройки проекта в базе (таблица app_settings): ключ → JSON. Сейчас — точка сброса прибыли в админке."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)

PROFIT_RESET_KEY = "profit_reset_at"


async def get_profit_reset_at(session: AsyncSession) -> datetime | None:
    """С какого момента считать прибыль, обороты игр и кейсов в админке (None — за всё время)."""
    try:
        raw = (
            await session.execute(text("SELECT value FROM app_settings WHERE key = :k"), {"k": PROFIT_RESET_KEY})
        ).scalar_one_or_none()
    except Exception as exc:  # noqa: BLE001 — таблицы может не быть до миграции
        log.warning("app_settings read failed: %s", exc)
        await session.rollback()
        return None
    if raw is None:
        return None
    data = json.loads(raw) if isinstance(raw, str) else raw
    try:
        return datetime.fromtimestamp(float(data["at"]), tz=timezone.utc)
    except (KeyError, TypeError, ValueError):
        return None


async def reset_profit_now(session: AsyncSession) -> datetime:
    """Обнулить прибыль в админке: дальше статистика игр и кейсов считается с этого момента."""
    now = datetime.now(timezone.utc)
    await session.execute(
        text(
            "INSERT INTO app_settings (key, value) VALUES (:k, CAST(:v AS jsonb)) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()"
        ),
        {"k": PROFIT_RESET_KEY, "v": json.dumps({"at": now.timestamp()})},
    )
    await session.commit()
    return now
