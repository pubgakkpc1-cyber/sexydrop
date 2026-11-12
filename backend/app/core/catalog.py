"""Каталог для сервера: цены подарков и состав кейсов (экспорт из клиента: `npm run export:catalog`)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.services import odds_service

_CATALOG_PATH = Path(__file__).resolve().parents[1] / "assets" / "catalog.json"

TON_PREFIX = "ton_"


@dataclass(frozen=True)
class CaseDef:
    id: str
    name: str
    price: int
    cooldown_ms: int | None
    entries: tuple[tuple[str, int], ...]
    all_items: tuple[str, ...]

    @property
    def is_free(self) -> bool:
        return self.cooldown_ms is not None


@lru_cache(maxsize=1)
def _raw() -> dict:
    return json.loads(_CATALOG_PATH.read_text("utf-8"))


def is_ton_prize(item_id: str) -> bool:
    return item_id.startswith(TON_PREFIX)


def ton_prize_minor(item_id: str) -> int:
    return int(item_id[len(TON_PREFIX) :])


def gift_price(gift_id: str) -> int | None:
    """Цена подарка в minor; None — такого подарка нет или он недоступен."""
    gift = _raw()["gifts"].get(gift_id)
    if gift is None or not gift.get("available", True):
        return None
    from app.services import market_prices  # цены по рынку (если админ включил обновление)

    live = market_prices.live_price(gift_id)
    return live if live is not None else int(gift["price"])


def gifts_priced(minor: int) -> list[str]:
    """NFT-подарки (id вида name-N) с ценой ровно minor — выплата Ракетки, равная цене NFT, выдаётся подарком."""
    import re

    return sorted(
        gid
        for gid, g in _raw()["gifts"].items()
        if g.get("available", True) and int(g["price"]) == minor and re.search(r"-\d$", gid)
    )


def gift_name(gift_id: str) -> str:
    gift = _raw()["gifts"].get(gift_id)
    return gift["name"] if gift else gift_id


def case_ids() -> list[str]:
    return list(_raw()["cases"].keys())


def get_case(case_id: str) -> CaseDef | None:
    raw = _raw()["cases"].get(case_id)
    if raw is None:
        return None
    return CaseDef(
        id=case_id,
        name=raw["name"],
        price=int(raw["price"]),
        cooldown_ms=raw["cooldown_ms"],
        entries=tuple((str(i), int(w)) for i, w in raw["entries"]),
        all_items=tuple(str(i) for i in raw["all_items"]),
    )


def rtp_pct() -> int:
    from app.core.config import get_settings

    return int(get_settings().case_rtp_pct)


def _cost(item_id: str) -> int:
    return ton_prize_minor(item_id) if is_ton_prize(item_id) else (gift_price(item_id) or 0)


MAX_WIN_PCT = 10.0  # шанс выпасть призу дороже цены кейса — не больше 10%


def tilt_to_rtp(entries: list[tuple[str, int]], price: int, target_pct: float, max_win_pct: float = MAX_WIN_PCT) -> list[tuple[str, int]]:
    """Сдвигает шансы так, чтобы средний возврат (RTP) кейса был target_pct % от цены, а шанс «в плюс» не превышал max_win_pct %.

    Веса домножаются на exp(-λ·цена_приза/цена_кейса): дорогие призы становятся реже, дешёвые чаще, порядок редкости сохраняется.
    Если суммарный шанс призов дороже кейса выше max_win_pct, их веса уменьшаются до этого предела (и RTP подгоняется уже с ним).
    Если самый дешёвый приз сам дороже цели, получится минимально возможный RTP (почти всё на самый дешёвый приз).
    """
    import math

    if price <= 0 or not entries:
        return list(entries)
    xs = [_cost(i) / price for i, _w in entries]
    ws = [float(w) for _i, w in entries]
    x0 = min(xs)
    target = target_pct / 100.0
    cap = max_win_pct / 100.0

    def weights(lam: float) -> list[float]:
        t = [w * math.exp(max(-700.0, min(700.0, -lam * (x - x0)))) for w, x in zip(ws, xs)]
        win = sum(a for a, x in zip(t, xs) if x > 1)
        rest = sum(t) - win
        if win > 0 and rest > 0 and win / (win + rest) > cap:
            k = cap * rest / ((1 - cap) * win)
            t = [a * k if x > 1 else a for a, x in zip(t, xs)]
        return t

    def rtp(lam: float) -> float:
        t = weights(lam)
        return sum(a * x for a, x in zip(t, xs)) / sum(t)

    lo, hi = -5.0, 600.0
    if rtp(lo) <= target:
        lam = lo
    elif rtp(hi) >= target:
        lam = hi
    else:
        for _ in range(80):
            mid = (lo + hi) / 2
            if rtp(mid) > target:
                lo = mid
            else:
                hi = mid
        lam = (lo + hi) / 2
    t = weights(lam)
    scale = 1_000_000 / sum(t)
    out = [(i, int(round(a * scale))) for (i, _w), a in zip(entries, t)]
    cheapest = min(range(len(out)), key=lambda k: xs[k])
    if out[cheapest][1] <= 0:
        out[cheapest] = (out[cheapest][0], 1)
    return [(i, w) for i, w in out if w > 0]


MAX_LOSING_ITEMS = 4  # в платном кейсе не больше 4 призов дешевле цены кейса (не окупают прокрут)
TON_PRIZE_MAX_CASE = 15_000  # TON-призы остаются только в кейсах дешевле 15 TON


MAX_TON_PRIZES = 3  # в одном кейсе не больше 3 призов в TON


def shape_entries(entries: list[tuple[str, int]], price: int) -> list[tuple[str, int]]:
    """Состав платного кейса.

    - TON-призы только «снизу»: дешевле самого дешёвого подарка кейса, и не больше MAX_TON_PRIZES штук;
    - в кейсе от 15 TON TON-призы убираются, если без них остаётся хотя бы один неокупающий подарок;
    - неокупающих призов (дешевле цены кейса) не больше MAX_LOSING_ITEMS: остаются те, что ближе к 45% цены кейса —
      так среднюю отдачу можно свести к целевому RTP;
    - окупающие призы (дороже или равные цене кейса) остаются все, их суммарный шанс ограничивается отдельно.
    """
    ents = list(entries)
    gifts = [e for e in ents if not is_ton_prize(e[0])]
    if price >= TON_PRIZE_MAX_CASE and any(_cost(i) < price for i, _w in gifts):
        ents = gifts
    elif gifts:
        floor = min(_cost(i) for i, _w in gifts)
        tons = sorted((e for e in ents if is_ton_prize(e[0]) and _cost(e[0]) < floor), key=lambda e: abs(_cost(e[0]) - 0.45 * price))
        keep_ton = {i for i, _w in tons[:MAX_TON_PRIZES]}
        ents = [(i, w) for i, w in ents if not is_ton_prize(i) or i in keep_ton]
    losing = [e for e in ents if _cost(e[0]) < price]
    if len(losing) > MAX_LOSING_ITEMS:
        keep = {i for i, _w in sorted(losing, key=lambda e: abs(_cost(e[0]) - 0.45 * price))[:MAX_LOSING_ITEMS]}
        ents = [(i, w) for i, w in ents if _cost(i) >= price or i in keep]
    return ents


def effective_entries(case: CaseDef) -> list[tuple[str, int]]:
    """Шансы кейса: переопределения админа, затем (для платных кейсов) состав и подгонка под целевой RTP."""
    base = _admin_entries(case)
    pct = rtp_pct()
    if pct > 0 and not case.is_free:
        return tilt_to_rtp(shape_entries(base, case.price), case.price, pct)
    return base


def _admin_entries(case: CaseDef) -> list[tuple[str, int]]:
    """Шансы кейса с учётом переопределений админа (так же, как это делает клиент: нулевые призы убираются)."""
    override = odds_service.get_all().get(case.id)
    if not override:
        return list(case.entries)
    entries = [(item, int(override.get(item, 0))) for item in case.all_items]
    entries = [(item, w) for item, w in entries if w > 0]
    return entries or list(case.entries)
