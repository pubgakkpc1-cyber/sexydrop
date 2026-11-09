"""Режим «Технические работы»: пока включён, API (кроме входа, админки и вебхука) отвечает 503, бот пишет, что работы идут.

Флаг хранится в app_settings (ключ maintenance), переключается из админки без перезапуска сервера.
"""

from __future__ import annotations

import json
import logging
import time

import httpx
from sqlalchemy import text

from app.core.config import get_settings
from app.core.db import get_session_factory

log = logging.getLogger("sexydrop.maintenance")

KEY = "maintenance"
_cache: dict[str, float | bool] = {"on": False, "at": 0.0}
TTL_S = 5.0


async def is_on() -> bool:
    """Включён ли режим работ (кэш на несколько секунд, чтобы не ходить в базу на каждый запрос)."""
    now = time.monotonic()
    if now - float(_cache["at"]) < TTL_S:
        return bool(_cache["on"])
    on = False
    try:
        async with get_session_factory()() as session:
            raw = (await session.execute(text("SELECT value FROM app_settings WHERE key = :k"), {"k": KEY})).scalar_one_or_none()
        if raw is not None:
            data = json.loads(raw) if isinstance(raw, str) else raw
            on = bool(data.get("on"))
    except Exception as exc:  # noqa: BLE001 — нет таблицы/базы: считаем, что работ нет
        log.warning("maintenance read failed: %s", exc)
    _cache["on"], _cache["at"] = on, now
    return on


async def set_on(on: bool) -> None:
    async with get_session_factory()() as session:
        await session.execute(
            text(
                "INSERT INTO app_settings (key, value) VALUES (:k, CAST(:v AS jsonb)) "
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()"
            ),
            {"k": KEY, "v": json.dumps({"on": on, "at": time.time()})},
        )
        await session.commit()
    _cache["on"], _cache["at"] = on, time.monotonic()


def notice_text(premium: bool = True) -> str:
    """Сообщение игрокам: бот не работает 1–2 дня (премиум-эмодзи, обычные при отказе Telegram)."""
    from app.services.telegram_bot import em

    def e(name: str) -> str:
        return em(name, premium)

    return (
        f"{e('spark')} <b>Технические работы</b>\n\n"
        "Бот временно не работает: мы обновляем SEXY DROP. Это займёт <b>1–2 дня</b>.\n\n"
        f"{e('shield')} Баланс, подарки и звёзды сохранены.\n"
        f"{e('dot')} Игры, кейсы, вывод и задания недоступны до конца работ.\n"
        f"{e('dot')} Ничего делать не нужно — просто подождите.\n\n"
        f"{e('check')} Как всё заработает, напишем в канале @SexyDrop_official"
    )


async def send_notice(chat_id: int) -> bool:
    """Ответ бота в личку, пока идут работы."""
    token = get_settings().bot_token
    if not token:
        return False
    async with httpx.AsyncClient(timeout=20.0) as client:
        for premium in (True, False):
            body = (
                await client.post(
                    f"https://api.telegram.org/bot{token}/sendMessage",
                    json={"chat_id": chat_id, "text": notice_text(premium), "parse_mode": "HTML", "disable_web_page_preview": True},
                )
            ).json()
            if body.get("ok"):
                return True
            log.warning("maintenance notice (premium=%s) failed: %s", premium, body.get("description"))
    return False


_admin_tokens: dict[str, tuple[bool, float]] = {}


async def token_is_admin(authorization: str | None) -> bool:
    """Админ ли владелец Bearer-токена (кэш на минуту): админ пользуется приложением и во время технических работ."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return False
    token = authorization[7:].strip()
    hit = _admin_tokens.get(token)
    now = time.monotonic()
    if hit and now - hit[1] < 60:
        return hit[0]
    ok = False
    try:
        import uuid

        from app.api.odds import ADMIN_USERNAMES
        from app.core.security import decode_access_token
        from app.models.user import User

        sub = decode_access_token(token).get("sub")
        if sub:
            async with get_session_factory()() as session:
                user = await session.get(User, uuid.UUID(str(sub)))
            ok = bool(user and user.username and user.username.lower().lstrip("@") in ADMIN_USERNAMES)
    except Exception:  # noqa: BLE001 — плохой токен: не админ
        ok = False
    if len(_admin_tokens) > 200:
        _admin_tokens.clear()
    _admin_tokens[token] = (ok, now)
    return ok
