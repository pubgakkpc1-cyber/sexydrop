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
from sqlalchemy.ext.asyncio import AsyncSession

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

CAPTION_MAX = 1024  # лимит подписи к фото в Telegram

# Готовые посты (картинка + текст): админ выбирает в рассылке одним нажатием.
PRESETS: dict[str, dict[str, str]] = {
    "clicker": {"label": "Кликалка: запуск (картинка + пост)", "photo": "clicker-photo.jpg", "button": "🕹 Играть в Кликалку"},
    "update": {"label": "Большое обновление (картинка + пост)", "photo": "update-photo.jpg", "button": "🎮 Играть"},
    "invite_clicks": {"label": "Кликалка: 5 000 / 10 000 за друга (картинка + пост)", "photo": "invite-clicks-photo.jpg", "button": "🕹 Играть в Кликалку"},
    "maintenance": {"label": "Технические работы: 1–2 дня (текст)", "photo": "", "button": ""},
}


def preset_text(preset: str, premium: bool = False) -> str:
    from app.services import ref_share

    if preset == "clicker":
        return ref_share.clicker_launch_caption(premium)
    if preset == "invite_clicks":
        return ref_share.invite_clicks_caption(premium)
    if preset == "update":
        return ref_share.update_caption(premium)
    if preset == "maintenance":
        from app.services import maintenance

        return maintenance.notice_text(premium)
    return ""


def _photo_bytes(preset: str) -> bytes | None:
    from app.services import ref_share

    name = PRESETS[preset]["photo"]
    if not name:
        return None
    path = next((d / name for d in ref_share._GIF_DIRS if (d / name).is_file()), None)
    return path.read_bytes() if path else None

_state: dict[str, Any] = {"state": "idle"}
_task: asyncio.Task[None] | None = None


async def audience_ids(session: AsyncSession, audience: str) -> list[int]:
    now = int(time.time())
    out: list[int] = []
    for uid, u in (await stats_service.users_snapshot(session)).items():
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


async def audience_counts(session: AsyncSession) -> dict[str, int]:
    return {k: len(await audience_ids(session, k)) for k in AUDIENCES}


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


async def _send_photo(client: httpx.AsyncClient, chat_id: int, caption: str, markup: dict[str, Any] | None, photo: bytes, name: str) -> bool:
    data: dict[str, Any] = {"chat_id": str(chat_id), "caption": caption, "parse_mode": "HTML"}
    if markup:
        import json

        data["reply_markup"] = json.dumps(markup, ensure_ascii=False)
    url = f"https://api.telegram.org/bot{get_settings().bot_token}/sendPhoto"
    try:
        r = await client.post(url, data=data, files={"photo": (name, photo, "image/jpeg")})
        if r.status_code == 429:
            await asyncio.sleep(float(r.json().get("parameters", {}).get("retry_after", 1)))
            r = await client.post(url, data=data, files={"photo": (name, photo, "image/jpeg")})
        if not r.is_success:
            _state["last_error"] = str(r.json().get("description", r.status_code))[:200]
        return r.is_success
    except Exception as exc:  # noqa: BLE001
        _state["last_error"] = str(exc)[:200]
        return False


async def _send_preset(client: httpx.AsyncClient, chat_id: int, preset: str, text: str, markup: dict[str, Any] | None, photo: bytes, premium: list[bool]) -> bool:
    """Готовый пост: если админ не менял текст — шлём с премиум-эмодзи, при отказе Telegram переходим на обычные."""
    name = PRESETS[preset]["photo"]
    unchanged = text.strip() == preset_text(preset, False).strip()
    if unchanged and premium[0]:
        if await _send_photo(client, chat_id, preset_text(preset, True), markup, photo, name):
            return True
        premium[0] = False  # Telegram не принял премиум-эмодзи: дальше обычные
    return await _send_photo(client, chat_id, text, markup, photo, name)


async def _send_text_preset(client: httpx.AsyncClient, chat_id: int, preset: str, text: str, markup: dict[str, Any] | None, premium: list[bool]) -> bool:
    """Готовый текстовый пост: без правок — с премиум-эмодзи, при отказе Telegram — обычные."""
    if text.strip() == preset_text(preset, False).strip() and premium[0]:
        if await _send(client, chat_id, preset_text(preset, True), markup):
            return True
        premium[0] = False
    return await _send(client, chat_id, text, markup)


async def _run(ids: list[int], text: str, markup: dict[str, Any] | None, preset: str | None = None) -> None:
    photo = _photo_bytes(preset) if preset else None
    premium = [True]
    async with httpx.AsyncClient(timeout=30) as client:
        for chat_id in ids:
            if preset and photo:
                ok = await _send_preset(client, chat_id, preset, text, markup, photo, premium)
            elif preset:
                ok = await _send_text_preset(client, chat_id, preset, text, markup, premium)
            else:
                ok = await _send(client, chat_id, text, markup)
            _state["sent" if ok else "failed"] += 1
            await asyncio.sleep(PAUSE_S)
    _state["state"] = "done"
    _state["finished"] = int(time.time())


async def send_test(chat_id: int, text: str, args: MarkupArgs, preset: str | None = None) -> tuple[bool, str | None]:
    _state.pop("last_error", None)
    async with httpx.AsyncClient(timeout=30) as client:
        photo = _photo_bytes(preset) if preset else None
        if preset and photo:
            ok = await _send_preset(client, chat_id, preset, text, _markup(args), photo, [True])
        elif preset:
            ok = await _send_text_preset(client, chat_id, preset, text, _markup(args), [True])
        else:
            ok = await _send(client, chat_id, text, _markup(args))
    return ok, _state.get("last_error")


def start(audience: str, ids: list[int], text: str, args: MarkupArgs, preset: str | None = None) -> int:
    global _task, _state
    _state = {"state": "running", "audience": audience, "total": len(ids), "sent": 0, "failed": 0, "started": int(time.time())}
    _task = asyncio.get_running_loop().create_task(_run(ids, text, _markup(args), preset))
    return len(ids)
