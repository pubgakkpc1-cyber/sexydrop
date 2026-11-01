"""Шансы кейсов, выставленные админом: переопределения весов призов поверх дефолтов из каталога.

Розыгрыш кейсов идёт на устройстве игрока, поэтому приложение при запуске забирает эти переопределения
(`GET /api/odds`) и подменяет веса. Хранится в JSON на диске контейнера: без постоянного тома файл
сбрасывается при деплое, и кейсы возвращаются к дефолтным шансам.
"""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path

from app.core.config import get_settings

log = logging.getLogger("sexydrop.odds")

MAX_WEIGHT = 10_000_000
MAX_ITEMS = 200

_lock = threading.Lock()
_state: dict[str, dict[str, int]] | None = None


def _path() -> Path:
    return Path(get_settings().odds_path)


def _load() -> dict[str, dict[str, int]]:
    global _state
    if _state is None:
        try:
            _state = json.loads(_path().read_text("utf-8"))
        except Exception:  # noqa: BLE001
            _state = {}
    return _state


def reset_for_tests() -> None:
    global _state
    _state = {}


def _save() -> None:
    try:
        path = _path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(_state, ensure_ascii=False), "utf-8")
    except Exception as exc:  # noqa: BLE001
        log.warning("odds save failed: %s", exc)


def get_all() -> dict[str, dict[str, int]]:
    with _lock:
        return {k: dict(v) for k, v in _load().items()}


def set_case(case_id: str, weights: dict[str, int]) -> None:
    if not weights or len(weights) > MAX_ITEMS:
        raise ValueError("Нужен список призов")
    clean: dict[str, int] = {}
    for item, w in weights.items():
        if not item or len(item) > 64 or not isinstance(w, int) or isinstance(w, bool) or not 0 <= w <= MAX_WEIGHT:
            raise ValueError("Некорректный вес приза")
        clean[item] = w
    if sum(clean.values()) <= 0:
        raise ValueError("Сумма шансов должна быть больше нуля")
    with _lock:
        _load()[case_id] = clean
        _save()


def reset_case(case_id: str) -> None:
    with _lock:
        _load().pop(case_id, None)
        _save()
