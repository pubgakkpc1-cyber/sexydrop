"""Цены NFT-подарков по реальному рынку.

- Раз в час сервер сам забирает флор каждой коллекции (Fragment) и ставит цены подарков:
  одна цена на все модели и фоны коллекции = самый дешёвый лот коллекции × (1 + наценка админа);
  исключение — фон Black: берётся самый дешёвый лот именно с этим фоном (не ниже флора коллекции и не выше 5 флоров).
- Наценка (%) и последние флоры хранятся в app_settings (ключ market_prices), поэтому все экземпляры сервера видят одно и то же.
- Пока админ не запускал обновление и не менял наценку, цены каталога не трогаются.
- При выводе подарка делается контрольная проверка актуальной цены (`check_withdraw`): резкий рост выше банка призов → ручная проверка.
Подключены Fragment; Tonnel и Getgems требуют ключей доступа — добавляются как ещё один `fetch_floor`, когда ключи появятся.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import catalog
from app.core.config import get_settings
from app.core.db import get_session_factory

log = logging.getLogger(__name__)

KEY = "market_prices"
_ASSET = Path(__file__).resolve().parents[1] / "assets" / "gift_market.json"
CATALOG_MARKUP_PCT = 2.0  # наценка, уже заложенная в базовые цены каталога
DEFAULT_MARKUP_PCT = 2.0
MAX_MARKUP_PCT = 100.0
INTERVAL_S = 60 * 60  # обновление раз в час, само, без подтверждения
RATIO_MIN, RATIO_MAX = 0.25, 4.0  # защита от кривых данных рынка
SURGE_PCT = 15  # «резко подорожал»: рост цены с момента выпадения подарка, %
_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
_ITEM_RE = re.compile(r'class="tm-grid-item">.*?tm-value icon-before icon-ton">([\d,\.]+)<', re.S)

_state: dict[str, Any] = {"markup_pct": None, "floors": {}, "updated_at": None, "claimed_at": 0, "last": None}
_live: dict[str, int] = {}
_lock = asyncio.Lock()


@lru_cache(maxsize=1)
def _assets() -> dict[str, dict[str, Any]]:
    return json.loads(_ASSET.read_text("utf-8"))


def live_price(gift_id: str) -> int | None:
    """Цена подарка по рынку (minor); None — для подарка рыночной цены нет, берётся каталожная."""
    return _live.get(gift_id)


def markup_pct() -> float:
    v = _state.get("markup_pct")
    return float(v) if v is not None else DEFAULT_MARKUP_PCT


PREMIUM_BACKDROP = "Black"  # фон с отдельной ценой
MAX_PREMIUM = 5.0  # цена фона Black не выше 5 флоров коллекции


def _floor_for(meta: dict[str, Any], floors: dict[str, float]) -> float | None:
    col = floors.get(meta["slug"])
    if not col or col <= 0:
        return None
    ref = meta["ref_floor_ton"]
    if ref > 0:
        col = min(ref * RATIO_MAX, max(ref * RATIO_MIN, col))  # защита от кривых данных рынка
    if meta.get("backdrop") == PREMIUM_BACKDROP:
        black = floors.get(f"{meta['slug']}|{PREMIUM_BACKDROP}")
        if black and black > 0:
            return min(col * MAX_PREMIUM, max(col, black))
    return col


def _compute_one(gift_id: str, floors: dict[str, float], markup: float) -> int | None:
    meta = _assets().get(gift_id)
    if meta is None:
        return None
    floor = _floor_for(meta, floors)
    if floor is None:  # рынок ещё не отвечал: прежняя цена каталога с новой наценкой
        base = meta["base_minor"] / (1 + CATALOG_MARKUP_PCT / 100)
        return max(1, int(round(base * (1 + markup / 100))))
    return max(1, int(round(floor * 1000 * (1 + markup / 100))))


def _recompute() -> None:
    markup = markup_pct()
    floors = {k: float(v) for k, v in (_state.get("floors") or {}).items()}
    active = _state.get("markup_pct") is not None or bool(floors)
    _live.clear()
    if not active:
        return
    for gid in _assets():
        p = _compute_one(gid, floors, markup)
        if p is not None:
            _live[gid] = p


async def _read(session: AsyncSession) -> dict[str, Any]:
    raw = (await session.execute(text("SELECT value FROM app_settings WHERE key = :k"), {"k": KEY})).scalar_one_or_none()
    if raw is None:
        return {}
    return json.loads(raw) if isinstance(raw, str) else dict(raw)


async def _write(session: AsyncSession, data: dict[str, Any]) -> None:
    await session.execute(
        text(
            "INSERT INTO app_settings (key, value) VALUES (:k, CAST(:v AS jsonb)) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()"
        ),
        {"k": KEY, "v": json.dumps(data)},
    )


async def load(session: AsyncSession | None = None) -> None:
    """Подтянуть наценку и флоры из базы и пересчитать цены в памяти."""
    if session is None:
        async with get_session_factory()() as s:
            await load(s)
        return
    try:
        data = await _read(session)
    except Exception as exc:  # noqa: BLE001 — таблицы может не быть до миграции
        log.warning("market_prices load failed: %s", exc)
        await session.rollback()
        return
    _state.update({k: data.get(k, _state.get(k)) for k in ("markup_pct", "floors", "updated_at", "claimed_at", "last")})
    _recompute()


async def set_markup(session: AsyncSession, pct: float) -> float:
    pct = round(max(0.0, min(MAX_MARKUP_PCT, float(pct))), 2)
    data = await _read(session)
    data["markup_pct"] = pct
    await _write(session, data)
    await session.commit()
    _state["markup_pct"] = pct
    _recompute()
    return pct


# ------------------------------------------------------------------ рынок

async def fetch_floor(client: httpx.AsyncClient, slug: str, query: str = "") -> float | None:
    """Минимальная цена лота коллекции на Fragment (TON), при `query` — лота с этим фоном/моделью; None — лотов нет."""
    params = {"filter": "sale", "sort": "price_asc", **({"query": query} if query else {})}
    res = await client.get(f"https://fragment.com/gifts/{slug}", params=params, headers=_UA)
    res.raise_for_status()
    prices = [float(p.replace(",", "")) for p in _ITEM_RE.findall(res.text)]
    return min(prices) if prices else None


async def _fetch_many(slugs: list[str]) -> tuple[dict[str, float], list[str]]:
    """slugs: «коллекция» или «коллекция|запрос» (цена с фоном Black); возвращает цены по тем же ключам."""
    sem = asyncio.Semaphore(6)
    ok: dict[str, float] = {}
    failed: list[str] = []

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:

        async def one(key: str) -> None:
            slug, _, query = key.partition("|")
            async with sem:
                for attempt in range(2):
                    try:
                        floor = await fetch_floor(client, slug, query)
                        if floor:
                            ok[key] = floor
                        elif not query:
                            failed.append(key)
                        await asyncio.sleep(0.25)
                        return
                    except Exception as exc:  # noqa: BLE001
                        if attempt == 1:
                            log.info("floor %s failed: %s", key, exc)
                            failed.append(key)
                        else:
                            await asyncio.sleep(1.5)

        await asyncio.gather(*(one(s) for s in slugs))
    return ok, failed


async def refresh(*, trigger: str = "auto") -> dict[str, Any]:
    """Обновить флоры всех коллекций, пересчитать цены и сохранить. Возвращает отчёт для админки."""
    async with _lock:
        slugs = sorted(
            {m["slug"] for m in _assets().values()}
            | {f"{m['slug']}|{PREMIUM_BACKDROP}" for m in _assets().values() if m.get("backdrop") == PREMIUM_BACKDROP}
        )
        old_live = dict(_live) or {g: m["base_minor"] for g, m in _assets().items()}
        ok, failed = await _fetch_many(slugs)
        floors = {k: float(v) for k, v in (_state.get("floors") or {}).items()}
        floors.update(ok)
        now = time.time()
        report = {"at": now, "trigger": trigger, "collections": len(slugs), "ok": len(ok), "failed": len(failed)}
        async with get_session_factory()() as session:
            data = await _read(session)
            if ok:
                data["floors"] = floors
                data["updated_at"] = now
            data["claimed_at"] = now
            data["last"] = report
            if data.get("markup_pct") is None:
                data["markup_pct"] = DEFAULT_MARKUP_PCT
            await _write(session, data)
            await session.commit()
        _state.update({"floors": floors, "markup_pct": data["markup_pct"], "last": report, "claimed_at": now})
        if ok:
            _state["updated_at"] = now
        _recompute()
        changes = []
        for gid, new in _live.items():
            old = old_live.get(gid, new)
            if old and abs(new - old) * 100 >= old * 5:
                changes.append({"gift_id": gid, "name": catalog.gift_name(gid), "old": old, "new": new})
        changes.sort(key=lambda c: abs(c["new"] - c["old"]) / max(1, c["old"]), reverse=True)
        report["changed"] = len(changes)
        report["top"] = changes[:8]
        return report


async def status() -> dict[str, Any]:
    await load()
    return {
        "markup_pct": markup_pct(),
        "updated_at": _state.get("updated_at"),
        "interval_min": INTERVAL_S // 60,
        "collections": len({m["slug"] for m in _assets().values()}),
        "floors": len(_state.get("floors") or {}),
        "last": _state.get("last"),
        "active": bool(_live),
    }


def public_prices() -> dict[str, int]:
    """Цены, которые отличаются от каталожных — для клиента (показ цен совпадает с серверными)."""
    base = catalog._raw()["gifts"]
    return {g: p for g, p in _live.items() if g in base and int(base[g]["price"]) != p}


async def loop() -> None:
    """Фоновое обновление: подхватывает общее состояние раз в минуту и, когда пора, обновляет флоры (один экземпляр за раз)."""
    await asyncio.sleep(3)
    while True:
        try:
            await load()
            due = time.time() - float(_state.get("claimed_at") or 0) >= INTERVAL_S
            if due:
                await refresh(trigger="auto")
        except Exception as exc:  # noqa: BLE001
            log.warning("market_prices loop: %s", exc)
        await asyncio.sleep(60)


# ------------------------------------------------------------------ проверка при выводе

async def _bank_minor(session: AsyncSession) -> int | None:
    from app.services import prize_bank

    if not prize_bank.enabled():
        return None
    raw = (await session.execute(text("SELECT value FROM app_settings WHERE key = :k"), {"k": prize_bank.KEY})).scalar_one_or_none()
    if raw is None:
        return 0
    data = json.loads(raw) if isinstance(raw, str) else raw
    return max(0, int((data or {}).get("minor", 0)))


async def check_withdraw(session: AsyncSession, gift_id: str, stored_minor: int) -> dict[str, Any] | None:
    """Контрольная цена перед выводом. Возвращает причину ручной проверки или None (всё в порядке / рынок недоступен)."""
    meta = _assets().get(gift_id)
    if meta is None or get_settings().app_env == "test":
        return None
    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            floor = await fetch_floor(client, meta["slug"])
            black = await fetch_floor(client, meta["slug"], PREMIUM_BACKDROP) if meta.get("backdrop") == PREMIUM_BACKDROP else None
    except Exception as exc:  # noqa: BLE001
        log.info("withdraw price check unavailable: %s", exc)
        return None
    if not floor:
        return None
    floors = {k: float(v) for k, v in (_state.get("floors") or {}).items()}
    floors[meta["slug"]] = floor
    if black:
        floors[f"{meta['slug']}|{PREMIUM_BACKDROP}"] = black
    now_minor = _compute_one(gift_id, floors, markup_pct())
    if now_minor is None:
        return None
    surge = now_minor - int(stored_minor)
    if surge * 100 < int(stored_minor) * SURGE_PCT:
        return {"market_minor": now_minor, "review": None}
    bank = await _bank_minor(session)
    if bank is not None and surge <= bank:
        return {"market_minor": now_minor, "review": None}
    pct = round(surge * 100 / max(1, int(stored_minor)))
    return {
        "market_minor": now_minor,
        "review": f"цена выросла на {pct}%: при выпадении {stored_minor / 1000:g} TON, сейчас {now_minor / 1000:g} TON"
        + (f"; разница больше банка призов ({bank / 1000:g} TON)" if bank is not None else ""),
    }
