"""Шансы кейсов, выставленные админом: переопределения весов призов поверх дефолтов из каталога.

Розыгрыш кейсов идёт на устройстве игрока, поэтому приложение при запуске забирает эти переопределения
(`GET /api/odds`) и подменяет веса. Источник правды — таблица `case_odds` в Postgres (переживает деплой);
JSON-файл на диске — запасной вариант, если база недоступна.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path

from sqlalchemy import text

from app.core.config import get_settings
from app.core.db import get_session_factory

log = logging.getLogger("sexydrop.odds")

MAX_WEIGHT = 10_000_000
MAX_ITEMS = 200
RETRY_DB_S = 30.0

_lock = threading.Lock()
_state: dict[str, dict[str, int]] | None = None
_db_loaded = False
_db_failed_at = 0.0


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
    global _state, _db_loaded, _db_failed_at
    _state = {}
    _db_loaded = False
    _db_failed_at = 0.0


def _save_file() -> None:
    try:
        path = _path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(_state, ensure_ascii=False), "utf-8")
    except Exception as exc:  # noqa: BLE001
        log.warning("odds file save failed: %s", exc)


def _use_db() -> bool:
    return bool(get_settings().odds_use_db)


async def ensure_loaded() -> None:
    """Один раз за процесс подтягивает шансы из базы (при ошибке повторяет не чаще раза в 30 с)."""
    global _db_loaded, _db_failed_at, _state
    if _db_loaded or not _use_db():
        return
    if time.time() - _db_failed_at < RETRY_DB_S:
        return
    try:
        async with get_session_factory()() as session:
            rows = (await session.execute(text("SELECT case_id, weights FROM case_odds"))).all()
        loaded: dict[str, dict[str, int]] = {}
        for case_id, weights in rows:
            data = json.loads(weights) if isinstance(weights, str) else weights
            loaded[str(case_id)] = {str(k): int(v) for k, v in data.items()}
        with _lock:
            # то, что в файле, но ещё не успело попасть в базу, не теряем
            merged = {**_load(), **loaded}
            _state = merged
            _db_loaded = True
            _save_file()
        # доливаем в базу то, чего там нет (первый запуск после перехода с файла)
        for case_id, weights in merged.items():
            if case_id not in loaded:
                await _db_write(case_id, weights)
    except Exception as exc:  # noqa: BLE001
        _db_failed_at = time.time()
        log.warning("odds load from db failed: %s", exc)


async def _db_write(case_id: str, weights: dict[str, int] | None) -> None:
    global _db_failed_at
    if not _use_db():
        return
    try:
        async with get_session_factory()() as session:
            if weights is None:
                await session.execute(text("DELETE FROM case_odds WHERE case_id = :c"), {"c": case_id})
            else:
                await session.execute(
                    text(
                        "INSERT INTO case_odds (case_id, weights) VALUES (:c, CAST(:w AS jsonb)) "
                        "ON CONFLICT (case_id) DO UPDATE SET weights = EXCLUDED.weights, updated_at = now()"
                    ),
                    {"c": case_id, "w": json.dumps(weights)},
                )
            await session.commit()
    except Exception as exc:  # noqa: BLE001
        _db_failed_at = time.time()
        log.warning("odds db write failed (kept in file): %s", exc)


def get_all() -> dict[str, dict[str, int]]:
    with _lock:
        return {k: dict(v) for k, v in _load().items()}


def validate(weights: dict[str, int]) -> dict[str, int]:
    if not weights or len(weights) > MAX_ITEMS:
        raise ValueError("Нужен список призов")
    clean: dict[str, int] = {}
    for item, w in weights.items():
        if not item or len(item) > 64 or not isinstance(w, int) or isinstance(w, bool) or not 0 <= w <= MAX_WEIGHT:
            raise ValueError("Некорректный вес приза")
        clean[item] = w
    if sum(clean.values()) <= 0:
        raise ValueError("Сумма шансов должна быть больше нуля")
    return clean


async def set_case(case_id: str, weights: dict[str, int]) -> None:
    clean = validate(weights)
    with _lock:
        _load()[case_id] = clean
        _save_file()
    await _db_write(case_id, clean)


async def reset_case(case_id: str) -> None:
    with _lock:
        _load().pop(case_id, None)
        _save_file()
    await _db_write(case_id, None)
