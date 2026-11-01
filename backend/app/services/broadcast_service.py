"""Рассылки админа: сообщение от бота игрокам, которых сервер знает по событиям приложения.

Отправка идёт фоном с паузой между сообщениями (лимит Telegram ~30 в секунду), прогресс
доступен через `status()`. Те, кто заблокировал бота, считаются «недоставлено» и не мешают остальным.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.services import stats_service

log = logging.getLogger("sexydrop.broadcast")

AUDIENCES = {
    "all": "Все игроки",
    "active_7d": "Активные за 7 дней",
    "new_24h": "Новые за сутки",
    "inactive_7d": "Не заходили 7+ дней",
}
PAUSE_S = 0.05
MAX_TEXT = 3500

MarkupArgs = tuple[str | None, str | None, bool]

_state: dict[str, Any] = {"state": "idle"}
_task: asyncio.Task[None] | None = None


def audience_ids(audience: str) -> list[int]:
    now = int(time.time())
    out: list[int] = []
    for uid, u in stats_service.users_snapshot().items():
        if not uid.lstrip("-").isdigit():
            continue
        last, first = u.get("last", 0), u.get("first", 0)
        if audience == "active_7d" and last < now - 7 * 86400:
            continue
        if audience == "inactive_7d" and last >= now - 7 * 86400:
            continue
        if audience == "new_24h" and first < now - 86400:
            continue
        out.append(int(uid))
    return out


def audience_counts() -> dict[str, int]:
    return {k: len(audience_ids(k)) for k in AUDIENCES}


def status() -> dict[str, Any]:
    return dict(_state)


def is_running() -> bool:
    return _state.get("state") == "running"


def _markup(args: MarkupArgs) -> dict[str, Any] | None:
    button_text, button_url, open_app = args
    rows: list[list[dict[str, Any]]] = []
    base = get_settings().public_base_url
    if open_app and base:
        rows.append([{"text": button_text or "Играть", "web_app": {"url": base}}])
    elif button_text and button_url:
        rows.append([{"text": button_text, "url": button_url}])
    return {"inline_keyboard": rows} if rows else None


async def _send(client: httpx.AsyncClient, chat_id: int, text: str, markup: dict[str, Any] | None) -> bool:
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if markup:
        payload["reply_markup"] = markup
    url = f"https://api.telegram.org/bot{get_settings().bot_token}/sendMessage"
    try:
        r = await client.post(url, json=payload)
        if r.status_code == 429:
            await asyncio.sleep(float(r.json().get("parameters", {}).get("retry_after", 1)))
            r = await client.post(url, json=payload)
        if not r.is_success:
            _state["last_error"] = str(r.json().get("description", r.status_code))[:200]
        return r.is_success
    except Exception as exc:  # noqa: BLE001
        _state["last_error"] = str(exc)[:200]
        return False


async def _run(ids: list[int], text: str, markup: dict[str, Any] | None) -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        for chat_id in ids:
            ok = await _send(client, chat_id, text, markup)
            _state["sent" if ok else "failed"] += 1
            await asyncio.sleep(PAUSE_S)
    _state["state"] = "done"
    _state["finished"] = int(time.time())


async def send_test(chat_id: int, text: str, args: MarkupArgs) -> tuple[bool, str | None]:
    _state.pop("last_error", None)
    async with httpx.AsyncClient(timeout=15) as client:
        ok = await _send(client, chat_id, text, _markup(args))
    return ok, _state.get("last_error")


def start(audience: str, text: str, args: MarkupArgs) -> int:
    global _task, _state
    ids = audience_ids(audience)
    _state = {"state": "running", "audience": audience, "total": len(ids), "sent": 0, "failed": 0, "started": int(time.time())}
    _task = asyncio.get_running_loop().create_task(_run(ids, text, _markup(args)))
    return len(ids)
