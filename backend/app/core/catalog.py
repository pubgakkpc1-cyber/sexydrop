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
    return int(gift["price"])


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


def effective_entries(case: CaseDef) -> list[tuple[str, int]]:
    """Шансы кейса с учётом переопределений админа (так же, как это делает клиент: нулевые призы убираются)."""
    override = odds_service.get_all().get(case.id)
    if not override:
        return list(case.entries)
    entries = [(item, int(override.get(item, 0))) for item in case.all_items]
    entries = [(item, w) for item, w in entries if w > 0]
    return entries or list(case.entries)
