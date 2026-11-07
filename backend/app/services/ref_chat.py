"""Чат SEXY DROP для рефералки: друг засчитывается (звёзды в банк, друзья для NFT), только если он в чате.

Сначала друг засчитывается сразу (как только прокрутил бесплатный кейс), а когда игрок что-то делает
(«Забрать» из банка, разблокировка NFT) — сервер перепроверяет всех его друзей через getChatMember.
Кого в чате нет — минус и запись в историю с причиной. Если проверить нельзя (нет токена, Telegram
не ответил) — друга не наказываем.
"""

from __future__ import annotations

import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.services.subscription_service import _is_member

CACHE_TTL_S = 120
LOG_KEY = "_ref_log"
LOG_LIMIT = 30

_cache: dict[int, tuple[float, bool | None]] = {}


def chat_title() -> str:
    return "чат SEXY DROP"


async def members(telegram_ids: list[int]) -> dict[int, bool | None]:
    """telegram id → в чате ли (None — проверить не удалось). Кэш на 2 минуты."""
    s = get_settings()
    chat = (s.ref_chat_id or "").strip()
    out: dict[int, bool | None] = {}
    if not chat or not s.bot_token:
        return {tg: None for tg in telegram_ids}
    now = time.time()
    todo = []
    for tg in telegram_ids:
        hit = _cache.get(tg)
        if hit and now - hit[0] < CACHE_TTL_S:
            out[tg] = hit[1]
        else:
            todo.append(tg)
    if todo:
        async with httpx.AsyncClient(timeout=8) as client:
            for tg in todo:
                ok = await _is_member(client, s.bot_token, chat, tg)
                _cache[tg] = (now, ok)
                out[tg] = ok
    return out


def clear_cache_for_tests() -> None:
    _cache.clear()


def add_log(claimed: dict[str, Any], delta: int, text: str, now_ms: int | None = None) -> None:
    """Запись в мини-историю банка друзей (новые сверху, хранится 30 последних)."""
    entry = {"at": now_ms if now_ms is not None else int(time.time() * 1000), "d": int(delta), "t": text}
    log = [entry, *list(claimed.get(LOG_KEY) or [])][:LOG_LIMIT]
    claimed[LOG_KEY] = log
