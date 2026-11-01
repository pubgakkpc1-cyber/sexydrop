"""Реферальный реестр: кто кого пригласил, есть ли у друга Telegram Premium и открыл ли он бесплатный кейс.

Баланс игроков хранится на их устройствах, а серверу нужно только знать, сколько друзей по ссылке
выполнили условие. Реестр лежит в JSON-файле контейнера (без постоянного тома сбрасывается при деплое):
устройство пригласившего запоминает уже засчитанных друзей, поэтому сброс реестра ничего не отнимает.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Any

from app.core.config import get_settings

log = logging.getLogger("sexydrop.referrals")

_lock = threading.Lock()
_state: dict[str, Any] | None = None
MAX_FRIENDS = 100_000


def _path() -> Path:
    return Path(get_settings().referrals_path)


def _load() -> dict[str, Any]:
    global _state
    if _state is None:
        try:
            _state = json.loads(_path().read_text("utf-8"))
        except Exception:  # noqa: BLE001
            _state = {"friends": {}}
    return _state


def reset_for_tests() -> None:
    global _state
    _state = {"friends": {}}


def _save() -> None:
    try:
        path = _path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(_state, ensure_ascii=False), "utf-8")
    except Exception as exc:  # noqa: BLE001
        log.warning("referrals save failed: %s", exc)


def join(friend: dict[str, Any], inviter_id: int) -> bool:
    """Друг перешёл по ссылке. Первый пригласивший остаётся навсегда; приглашать себя нельзя."""
    fid = str(friend["id"])
    if str(inviter_id) == fid:
        return False
    with _lock:
        friends = _load()["friends"]
        if fid in friends:
            # Premium мог появиться позже — обновляем признак
            friends[fid]["premium"] = bool(friend.get("is_premium")) or friends[fid]["premium"]
            _save()
            return False
        if len(friends) >= MAX_FRIENDS:
            return False
        friends[fid] = {
            "inviter": str(inviter_id),
            "premium": bool(friend.get("is_premium")),
            "qualified": False,
            "at": int(time.time()),
        }
        _save()
        return True


def qualify(friend: dict[str, Any]) -> bool:
    """Друг открыл бесплатный кейс — засчитывается пригласившему."""
    fid = str(friend["id"])
    with _lock:
        row = _load()["friends"].get(fid)
        if row is None:
            return False
        row["premium"] = bool(friend.get("is_premium")) or row["premium"]
        if not row["qualified"]:
            row["qualified"] = True
            row["qualified_at"] = int(time.time())
        _save()
        return True


def friends_of(inviter_id: int) -> list[dict[str, Any]]:
    with _lock:
        rows = _load()["friends"].items()
        return [
            {"id": fid, "premium": r["premium"], "qualified": r["qualified"]}
            for fid, r in rows
            if r["inviter"] == str(inviter_id)
        ]
