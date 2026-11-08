"""Реферальные приглашения: «Поделиться» из мини-аппа отправляет анимацию с подписью и текстовой ссылкой.

Для каждого места, где есть реферальная ссылка, своя гифка (public/brand/ref/<kind>.gif):
  invite   — экран «Пригласить»;
  unlock   — окно задания бесплатного кейса (NFT под замком);
  roulette — подарок под замком в инвентаре.

Мини-апп просит сервер подготовить сообщение (Bot API savePreparedInlineMessage) и открывает
окно выбора чата через WebApp.shareMessage. Админу гифки присылаются в бота: один раз после
деплоя новой версии и по команде /gifs.
"""

from __future__ import annotations

import asyncio
import html
import json
import logging
from pathlib import Path
from typing import Any

import httpx

from app.core.config import get_settings

log = logging.getLogger("sexydrop.refshare")

BOT_USERNAME = "sexydropbot"
PHOTO_W, PHOTO_H = 1280, 720  # баннеры public/brand/ref/<kind>-photo.jpg
# смена версии — админу снова придут все гифки после деплоя
PREVIEW_VERSION = "2026-11-08-photo-v1"

KINDS: dict[str, dict[str, str]] = {
    "invite": {
        "place": "Экран «Пригласить друзей»",
        "title": "🎁 <b>Бесплатные NFT-подарки в SEXY DROP</b>",
        "body": "Сундук FREE 24 — каждый день бесплатно, а первый кейс с NFT тебе тоже ничего не стоит.",
        "link": "Тык — забрать бесплатный кейс",
        "button": "🎁 Забрать бесплатный кейс",
    },
    "unlock": {
        "place": "Окно задания бесплатного кейса (NFT под замком)",
        "title": "🔓 <b>Друг ждёт тебя в SEXY DROP</b>",
        "body": "Зайди по ссылке и прокрути бесплатный кейс — он твой. Вступи в чат, и вы оба в плюсе.",
        "link": "Тык — крутить бесплатно",
        "button": "🔓 Крутить бесплатно",
    },
    "roulette": {
        "place": "Подарок под замком в инвентаре",
        "title": "🎰 <b>Крути рулетку NFT в SEXY DROP</b>",
        "body": "Редкие подарки падают каждый день. Первый кейс — бесплатно, FREE 24 — раз в сутки.",
        "link": "Тык — попробовать",
        "button": "🎰 Крутить рулетку",
    },
}

_APP_ROOT = Path(__file__).resolve().parents[1]  # backend/app
_GIF_DIRS = (
    Path("/app/dist/brand/ref"),  # Docker: собранный фронтенд
    _APP_ROOT.parents[1] / "dist" / "brand" / "ref",
    _APP_ROOT.parents[1] / "public" / "brand" / "ref",  # локальная разработка
)


def ref_link(telegram_id: int) -> str:
    return f"https://t.me/{BOT_USERNAME}?startapp=ref-{int(telegram_id)}"


def caption(kind: str, telegram_id: int) -> str:
    """HTML-подпись под гифкой: текст и кликабельная текстовая ссылка «Тык — …»."""
    k = KINDS[kind]
    link = html.escape(ref_link(telegram_id), quote=True)
    return f'{k["title"]}\n\n{k["body"]}\n\n👉 <a href="{link}">{k["link"]}</a>'


def keyboard(kind: str, telegram_id: int) -> dict[str, Any]:
    return {"inline_keyboard": [[{"text": KINDS[kind]["button"], "url": ref_link(telegram_id)}]]}


def _base_url() -> str:
    s = get_settings()
    return (s.public_base_url or s.app_url).rstrip("/")


def photo_path(kind: str) -> Path | None:
    for d in _GIF_DIRS:
        p = d / f"{kind}-photo.jpg"
        if p.is_file():
            return p
    return None


def _api() -> str:
    return f"https://api.telegram.org/bot{get_settings().bot_token}"


async def prepare_share(telegram_id: int, kind: str) -> str | None:
    """Готовит сообщение-гифку для WebApp.shareMessage. Возвращает id или None (Telegram отказал)."""
    if kind not in KINDS or not get_settings().bot_token:
        return None
    base = _base_url()
    result = {
        "type": "photo",
        "id": f"{kind}-{telegram_id}"[:64],
        "photo_url": f"{base}/brand/ref/{kind}-photo.jpg",
        "thumbnail_url": f"{base}/brand/ref/{kind}-photo.jpg",
        "photo_width": PHOTO_W,
        "photo_height": PHOTO_H,
        "caption": caption(kind, telegram_id),
        "parse_mode": "HTML",
        "reply_markup": keyboard(kind, telegram_id),
    }
    payload = {
        "user_id": int(telegram_id),
        "result": result,
        "allow_user_chats": True,
        "allow_bot_chats": False,
        "allow_group_chats": True,
        "allow_channel_chats": True,
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            body = (await client.post(f"{_api()}/savePreparedInlineMessage", json=payload)).json()
    except Exception as exc:  # noqa: BLE001
        log.warning("prepare share failed: %s", exc)
        return None
    if not body.get("ok"):
        log.warning("prepare share rejected: %s", body.get("description"))
        return None
    return str((body.get("result") or {}).get("id") or "") or None


async def send_previews(chat_id: int, telegram_id: int) -> int:
    """Присылает в чат все реферальные гифки ровно в том виде, в каком их получат друзья."""
    if not get_settings().bot_token:
        return 0
    sent = 0
    intro = "<b>Реферальные приглашения SEXY DROP</b>\n\nКаждая уходит из своего места в приложении:\n" + "\n".join(
        f"{i}. {html.escape(k['place'])}" for i, k in enumerate(KINDS.values(), start=1)
    )
    async with httpx.AsyncClient(timeout=60.0) as client:
        await client.post(f"{_api()}/sendMessage", json={"chat_id": chat_id, "text": intro, "parse_mode": "HTML"})
        for i, kind in enumerate(KINDS, start=1):
            path = photo_path(kind)
            if path is None:
                log.warning("ref photo %s not found", kind)
                continue
            data = {
                "chat_id": str(chat_id),
                "caption": f"<i>{i}. {html.escape(KINDS[kind]['place'])}</i>\n\n{caption(kind, telegram_id)}",
                "parse_mode": "HTML",
                "reply_markup": json.dumps(keyboard(kind, telegram_id), ensure_ascii=False),
            }
            res = await client.post(
                f"{_api()}/sendPhoto", data=data, files={"photo": (f"{kind}-photo.jpg", path.read_bytes(), "image/jpeg")}
            )
            body = res.json()
            if body.get("ok"):
                sent += 1
            else:
                log.warning("ref photo %s to %s failed: %s", kind, chat_id, body.get("description"))
    return sent


async def send_previews_to_admins_once(delay_s: float = 25.0) -> None:
    """После деплоя новой версии гифок присылает их каждому админу один раз (отметка в UserMeta)."""
    await asyncio.sleep(delay_s)
    if not get_settings().bot_token:
        return
    from sqlalchemy import func, select

    from app.api.odds import ADMIN_USERNAMES
    from app.core.db import get_session_factory
    from app.models.economy import UserMeta
    from app.models.user import User
    from app.services.economy_core import ensure_account

    try:
        async with get_session_factory()() as session:
            admins = (
                await session.execute(select(User).where(func.lower(User.username).in_(sorted(ADMIN_USERNAMES))))
            ).scalars().all()
            for admin in admins:
                await ensure_account(session, admin.id)
                meta = await session.get(UserMeta, admin.id)
                if meta is None or (meta.quests_claimed or {}).get("_refgifs") == PREVIEW_VERSION:
                    continue
                if await send_previews(admin.telegram_id, admin.telegram_id) > 0:
                    meta.quests_claimed = {**(meta.quests_claimed or {}), "_refgifs": PREVIEW_VERSION}
                    await session.commit()
                    log.info("ref photos sent to admin %s", admin.telegram_id)
    except Exception as exc:  # noqa: BLE001 — уведомление не должно ронять сервер
        log.warning("ref photos to admins failed: %s", exc)
