"""Статистика проекта для админ-панели: события игроков копятся в памяти и сохраняются в JSON.

Баланс и подарки игроков живут на их устройствах, поэтому сервер узнаёт о происходящем только из
событий, которые присылает приложение (раунд игры, открытие кейса, пополнение). Файл статистики
лежит на диске контейнера: без постоянного тома он сбрасывается при каждом перезапуске сервиса.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import get_settings

log = logging.getLogger("sexydrop.stats")

_lock = threading.Lock()
_state: dict[str, Any] | None = None
_last_save = 0.0
SAVE_EVERY_S = 10.0
MAX_USERS = 50_000


def _empty() -> dict[str, Any]:
    return {"since": int(time.time()), "users": {}, "games": {}, "cases": {}, "deposits": {}, "days": {}}


def _path() -> Path:
    return Path(get_settings().stats_path)


def _load() -> dict[str, Any]:
    global _state
    if _state is None:
        try:
            _state = json.loads(_path().read_text("utf-8"))
        except Exception:  # noqa: BLE001
            _state = _empty()
    return _state


def reset_for_tests() -> None:
    global _state, _last_save
    _state = _empty()
    _last_save = 0.0


def _save(force: bool = False) -> None:
    global _last_save
    now = time.time()
    if not force and now - _last_save < SAVE_EVERY_S:
        return
    _last_save = now
    try:
        path = _path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(_state, ensure_ascii=False), "utf-8")
    except Exception as exc:  # noqa: BLE001
        log.warning("stats save failed: %s", exc)


def _bucket(d: dict[str, Any], key: str, **defaults: int) -> dict[str, Any]:
    if key not in d:
        d[key] = dict(defaults)
    return d[key]


def record(user: dict[str, Any], event: dict[str, Any]) -> None:
    """Учитывает одно событие игрока. Все числа заранее проверены схемой запроса."""
    uid = str(user["id"])
    now = int(time.time())
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with _lock:
        st = _load()
        users = st["users"]
        if uid not in users and len(users) >= MAX_USERS:
            return
        u = _bucket(users, uid, first=now, last=now, events=0, wagered=0, delta=0)
        u["last"] = now
        u["events"] += 1
        shown = user.get("username") or user.get("first_name")
        if shown:
            u["name"] = str(shown)[:64]
        d = _bucket(st["days"], day, events=0)
        d["events"] += 1
        d.setdefault("users", [])
        if uid not in d["users"]:
            d["users"].append(uid)
        if u["first"] == now and u["events"] == 1:
            d["new"] = d.get("new", 0) + 1

        kind = event["type"]
        if kind == "game":
            g = _bucket(st["games"], event["game"], rounds=0, wagered=0, delta=0, wins=0)
            g["rounds"] += 1
            g["wagered"] += event["stake"]
            g["delta"] += event["delta"]
            g["wins"] += 1 if event["delta"] > 0 else 0
            u["wagered"] += event["stake"]
            u["delta"] += event["delta"]
        elif kind == "case":
            c = _bucket(st["cases"], event["case"], opens=0, spent=0, prize=0)
            c["opens"] += 1
            c["spent"] += event["price"]
            c["prize"] += event["prize"]
            u["wagered"] += event["price"]
            u["delta"] += event["prize"] - event["price"]
        elif kind == "deposit":
            dp = _bucket(st["deposits"], event["method"], count=0, amount=0)
            dp["count"] += 1
            dp["amount"] += event["amount"]
        for old in sorted(st["days"])[:-60]:
            del st["days"][old]
        _save()


def snapshot() -> dict[str, Any]:
    """Сводка для админки: итоги, таблицы по играм/кейсам/пополнениям, динамика за 14 дней."""
    with _lock:
        st = _load()
        now = int(time.time())
        users = st["users"]
        day_ago = now - 86400
        games = st["games"]
        cases = st["cases"]
        total_wagered = sum(g["wagered"] for g in games.values()) + sum(c["spent"] for c in cases.values())
        player_net = sum(g["delta"] for g in games.values()) + sum(c["prize"] - c["spent"] for c in cases.values())
        series = []
        for day in sorted(st["days"])[-14:]:
            row = st["days"][day]
            series.append({"day": day, "events": row["events"], "users": len(row.get("users", [])), "new": row.get("new", 0)})
        top = sorted(users.items(), key=lambda kv: kv[1]["wagered"], reverse=True)[:10]
        return {
            "since": st["since"],
            "users_total": len(users),
            "users_24h": sum(1 for u in users.values() if u["last"] >= day_ago),
            "users_new_24h": sum(1 for u in users.values() if u["first"] >= day_ago),
            "wagered": total_wagered,
            "house_profit": -player_net,
            "games": [{"game": k, **v} for k, v in sorted(games.items())],
            "cases": [{"case": k, **v} for k, v in sorted(cases.items(), key=lambda kv: -kv[1]["opens"])],
            "deposits": [{"method": k, **v} for k, v in sorted(deposits_items(st))],
            "series": series,
            "top": [{"id": k, "name": v.get("name"), "wagered": v["wagered"], "delta": v["delta"], "events": v["events"]} for k, v in top],
        }


def leaderboard(my_id: int | None = None, limit: int = 50) -> dict[str, Any]:
    """Рейтинг по обороту (1 TON оборота = 100 очков). Чужие id не отдаются: только имя и очки."""
    with _lock:
        users = _load()["users"]
        ranked = sorted(
            ((uid, u) for uid, u in users.items() if u["wagered"] > 0),
            key=lambda kv: kv[1]["wagered"],
            reverse=True,
        )
        rows = [
            {"rank": i + 1, "name": u.get("name") or "Игрок", "points": u["wagered"] // 10, "me": uid == str(my_id)}
            for i, (uid, u) in enumerate(ranked[:limit])
        ]
        me = next(({"rank": i + 1, "points": u["wagered"] // 10} for i, (uid, u) in enumerate(ranked) if uid == str(my_id)), None)
        return {"rows": rows, "me": me, "total": len(ranked)}


def deposits_items(st: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    return list(st["deposits"].items())


def flush() -> None:
    with _lock:
        if _state is not None:
            _save(force=True)


_ = defaultdict  # зарезервировано под будущие разрезы


def users_snapshot() -> dict[str, dict[str, Any]]:
    """Копия реестра игроков (id → first/last/name/...); для рассылок и списка игроков в админке."""
    with _lock:
        return {k: dict(v) for k, v in _load()["users"].items()}
