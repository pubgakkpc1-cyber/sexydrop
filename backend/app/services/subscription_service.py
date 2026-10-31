"""Проверка обязательных подписок на каналы (getChatMember) для бесплатных кейсов.

Бот должен быть администратором каналов, иначе Telegram не отдаёт список участников.
Если канал проверить нельзя (бот не админ, id приватного канала неизвестен), он помечается
subscribed = None («не проверено») и не блокирует открытие, чтобы не запереть всех игроков.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import get_settings

log = logging.getLogger("sexydrop.subs")

# Каналы, где бот стал админом (my_chat_member): chat_id -> название. Только в памяти процесса.
discovered_chats: dict[int, str] = {}

_MEMBER = {"creator", "administrator", "member"}


def channels() -> list[dict[str, Any]]:
    s = get_settings()
    private_id = s.sub_private_chat_id.strip()
    if not private_id:
        known = [cid for cid in discovered_chats if str(cid).startswith("-100")]
        private_id = str(known[0]) if len(known) == 1 else ""
    items: list[dict[str, Any]] = []
    if s.sub_public_chat:
        items.append({"key": "public", "title": s.sub_public_chat, "url": s.sub_public_url, "chat": s.sub_public_chat})
    if s.sub_private_url:
        items.append({"key": "private", "title": "Закрытый канал", "url": s.sub_private_url, "chat": private_id or None})
    return items


async def _is_member(client: httpx.AsyncClient, token: str, chat: str, user_id: int) -> bool | None:
    try:
        res = await client.get(
            f"https://api.telegram.org/bot{token}/getChatMember",
            params={"chat_id": chat, "user_id": user_id},
        )
        body = res.json()
    except Exception as exc:  # noqa: BLE001
        log.warning("getChatMember failed: %s", exc)
        return None
    if not body.get("ok"):
        log.warning("getChatMember %s: %s", chat, body.get("description"))
        return None
    member = body["result"]
    status = member.get("status")
    if status in _MEMBER:
        return True
    if status == "restricted":
        return bool(member.get("is_member"))
    return False


async def check(user_id: int) -> dict[str, Any]:
    token = get_settings().bot_token
    out: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        for ch in channels():
            subscribed = None
            if token and ch["chat"]:
                subscribed = await _is_member(client, token, str(ch["chat"]), user_id)
            out.append({"key": ch["key"], "title": ch["title"], "url": ch["url"], "subscribed": subscribed})
    return {"ok": all(c["subscribed"] is not False for c in out), "channels": out}
