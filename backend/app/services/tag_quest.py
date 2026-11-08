"""Задание «Поставь @sexydropbot в имя или описание»: 3 этапа, награда в звёздах раз в сутки.

1. Игрок ставит @sexydropbot в имя/фамилию или в «О себе» (bio) и жмёт «Готово» — сервер проверяет через getChat.
2. Держит 24 часа (сервер перепроверяет в момент «Забрать»).
3. Забирает награду в течение 10 часов после окончания 24 часов, иначе начинает заново.
Состояние в UserMeta.quests_claimed["_tag"]; награда — на звёздный баланс.
"""

from __future__ import annotations

import time
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.economy import UserMeta
from app.models.user import User
from app.services.economy_core import GameError, ensure_account

TAG = "@sexydropbot"
REWARD_STARS = 10
HOLD_MS = 24 * 3600 * 1000
CLAIM_WINDOW_MS = 10 * 3600 * 1000


def _now() -> int:
    return int(time.time() * 1000)


def _norm(text: str) -> str:
    """Нижний регистр, без пробелов и невидимых символов: «@SexyDrop Bot» и «@sexydropbot» — одно и то же."""
    drop = {c for c in text if c.isspace() or c in "​‌‍⁠﻿"}
    return "".join(c for c in text.lower() if c not in drop)


def _has(text: str) -> bool:
    n = _norm(text)
    return TAG in n or "t.me/sexydropbot" in n


async def tag_probe(telegram_id: int, known_names: tuple[str, ...] = ()) -> dict[str, Any]:
    """Где стоит ник: found (True/False/None — Telegram не ответил), where ('name'|'bio'|None), bio_visible.

    bio_visible=False — Telegram не отдал «О себе» боту (закрыто настройками приватности): тогда отсутствие ника
    в bio доказать нельзя, и игрока не наказываем.
    """
    if any(_has(n) for n in known_names if n):
        return {"found": True, "where": "name", "bio_visible": True}
    token = get_settings().bot_token
    if not token:
        return {"found": None, "where": None, "bio_visible": False}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            body = (await client.get(f"https://api.telegram.org/bot{token}/getChat", params={"chat_id": telegram_id})).json()
    except Exception:  # noqa: BLE001
        return {"found": None, "where": None, "bio_visible": False}
    if not body.get("ok"):
        return {"found": None, "where": None, "bio_visible": False}
    chat = body["result"]
    if any(_has(str(chat.get(k) or "")) for k in ("first_name", "last_name")):
        return {"found": True, "where": "name", "bio_visible": "bio" in chat}
    if _has(str(chat.get("bio") or "")):
        return {"found": True, "where": "bio", "bio_visible": True}
    return {"found": False, "where": None, "bio_visible": "bio" in chat}


async def has_tag(telegram_id: int, known_names: tuple[str, ...] = ()) -> bool | None:
    """True/False — ник есть/нет в имени или bio; None — проверить нельзя (не наказываем)."""
    return (await tag_probe(telegram_id, known_names))["found"]


def view(state: dict[str, Any] | None, now: int | None = None) -> dict[str, Any]:
    now = now if now is not None else _now()
    st = state or {}
    started = int(st.get("started_at") or 0)
    stage = 1
    if started:
        stage = 2 if now < started + HOLD_MS else 3
        if now > started + HOLD_MS + CLAIM_WINDOW_MS:
            stage, started = 1, 0  # не забрали вовремя — заново
    return {
        "tag": TAG,
        "reward": REWARD_STARS,
        "stage": stage,
        "started_at": started or None,
        "ready_at": started + HOLD_MS if started else None,
        "expires_at": started + HOLD_MS + CLAIM_WINDOW_MS if started else None,
        "total_claimed": int(st.get("total", 0)),
    }


async def _meta(session: AsyncSession, user_id: Any) -> UserMeta:
    await ensure_account(session, user_id)
    return (await session.execute(select(UserMeta).where(UserMeta.user_id == user_id).with_for_update())).scalar_one()


async def start(session: AsyncSession, user: User) -> dict[str, Any]:
    meta = await _meta(session, user.id)
    cur = view((meta.quests_claimed or {}).get("_tag"))
    if cur["stage"] != 1:
        return cur
    probe = await tag_probe(user.telegram_id, (user.first_name or "", user.last_name or ""))
    found = probe["found"]
    if found is False and not probe["bio_visible"]:
        raise GameError(
            "tag_bio_hidden",
            409,
            f"Не видим «О себе» — Telegram скрывает его от бота. Откройте Настройки → Конфиденциальность → О себе → «Все», или поставьте {TAG} в имя",
        )
    if found is None:
        raise GameError("tag_unknown", 503, "Не удалось проверить профиль, попробуйте ещё раз")
    if not found:
        raise GameError("tag_missing", 409, f"Не нашли {TAG} в имени или описании профиля. Если он стоит в «О себе», откройте Настройки → Конфиденциальность → О себе → «Все» и нажмите «Готово» ещё раз")
    claimed = dict(meta.quests_claimed or {})
    claimed["_tag"] = {**(claimed.get("_tag") or {}), "started_at": _now()}
    meta.quests_claimed = claimed
    await session.commit()
    return view(claimed["_tag"])


async def check(session: AsyncSession, user: User) -> dict[str, Any]:
    """Перепроверка на этапах 2–3: убрали ник — прогресс сбрасывается."""
    meta = await _meta(session, user.id)
    claimed = dict(meta.quests_claimed or {})
    cur = view(claimed.get("_tag"))
    if cur["stage"] != 1 and await has_tag(user.telegram_id, (user.first_name or "", user.last_name or "")) is False:
        claimed["_tag"] = {k: v for k, v in (claimed.get("_tag") or {}).items() if k != "started_at"}
        meta.quests_claimed = claimed
        await session.commit()
        raise GameError("tag_removed", 409, f"{TAG} пропал из профиля — отсчёт 24 часов сброшен")
    await session.commit()
    return cur


async def claim(session: AsyncSession, user: User) -> dict[str, Any]:
    meta = await _meta(session, user.id)
    claimed = dict(meta.quests_claimed or {})
    cur = view(claimed.get("_tag"))
    if cur["stage"] != 3:
        raise GameError("not_ready", 409, "Награду можно забрать через 24 часа после старта")
    if await has_tag(user.telegram_id, (user.first_name or "", user.last_name or "")) is False:
        claimed["_tag"] = {k: v for k, v in (claimed.get("_tag") or {}).items() if k != "started_at"}
        meta.quests_claimed = claimed
        await session.commit()
        raise GameError("tag_removed", 409, f"{TAG} пропал из профиля — награда не начислена")
    total = int((claimed.get("_tag") or {}).get("total", 0)) + 1
    claimed["_tag"] = {"total": total}
    meta.quests_claimed = claimed
    meta.stars = int(meta.stars) + REWARD_STARS
    await session.commit()
    return {"status": "ok", "stars": meta.stars, "reward": REWARD_STARS}


RECHECK_EVERY_S = 3600


async def recheck_all() -> int:
    """Раз в час: у всех, кто держит ник (этап 2–3), проверяем, что он на месте; убрали — сбрасываем. Возвращает число сброшенных."""
    from sqlalchemy import select as _select

    from app.core.db import get_session_factory

    reset = 0
    async with get_session_factory()() as session:
        rows = (await session.execute(_select(UserMeta, User).join(User, User.id == UserMeta.user_id))).all()
        for meta, user in rows:
            claimed = dict(meta.quests_claimed or {})
            tag = claimed.get("_tag") or {}
            if not tag.get("started_at") or view(tag)["stage"] == 1:
                continue
            probe = await tag_probe(user.telegram_id, (user.first_name or "", user.last_name or ""))
            if probe["found"] is False and probe["bio_visible"]:
                claimed["_tag"] = {k: v for k, v in tag.items() if k != "started_at"}
                meta.quests_claimed = claimed
                reset += 1
        await session.commit()
    return reset


async def recheck_loop() -> None:
    """Фоновая почасовая проверка ников для задания (запускается при старте сервера)."""
    import asyncio
    import logging

    log = logging.getLogger("sexydrop.tagquest")
    await asyncio.sleep(120)
    while True:
        try:
            n = await recheck_all()
            if n:
                log.info("tag quest: reset %s players who removed the tag", n)
        except Exception as exc:  # noqa: BLE001 — проверка не должна ронять сервер
            log.warning("tag quest recheck failed: %s", exc)
        await asyncio.sleep(RECHECK_EVERY_S)
