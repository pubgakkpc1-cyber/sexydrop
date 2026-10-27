from __future__ import annotations

from decimal import Decimal
from typing import NamedTuple


class CaseEntry(NamedTuple):
    gift_id: str
    weight: int


class CaseDefinition(NamedTuple):
    id: str
    name: str
    price_gram: Decimal
    is_free: bool
    free_cooldown_seconds: int | None
    is_new: bool
    glow: str
    entries: tuple[CaseEntry, ...]


CASE_WEIGHTS: dict[str, tuple[tuple[str, int], ...]] = {
    "farm": (("fresh-socks", 8), ("scared-cat", 1), ("instant-ramen", 1), ("chill-flame", 1)),
    "autumn": (
        ("chill-flame", 1),
        ("xmas-stocking", 1),
        ("holiday-gift", 1),
        ("heart-locket", 1),
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 9),
        ("astral-shard", 3),
        ("durovs-cap", 2),
    ),
    "movie": (
        ("holiday-gift", 2),
        ("heart-locket", 1),
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 1),
        ("astral-shard", 2),
        ("durovs-cap", 1),
        ("diamond-ring", 1),
    ),
    "telegram": (
        ("holiday-gift", 1),
        ("heart-locket", 1),
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 1),
        ("astral-shard", 6),
        ("durovs-cap", 2),
        ("diamond-ring", 1),
    ),
    "space": (
        ("heart-locket", 1),
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 1),
        ("astral-shard", 1),
        ("durovs-cap", 1),
        ("diamond-ring", 2),
    ),
    "magic": (
        ("holiday-gift", 1),
        ("heart-locket", 1),
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 1),
        ("astral-shard", 6),
        ("durovs-cap", 2),
        ("diamond-ring", 1),
    ),
    "kitty": (
        ("holiday-gift", 1),
        ("heart-locket", 1),
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 1),
        ("astral-shard", 6),
        ("durovs-cap", 2),
        ("diamond-ring", 1),
    ),
    "adult18": (
        ("heart-locket", 1),
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 1),
        ("astral-shard", 1),
        ("durovs-cap", 5),
        ("diamond-ring", 3),
    ),
    "money": (
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 1),
        ("astral-shard", 1),
        ("durovs-cap", 5),
        ("diamond-ring", 2),
        ("neon-dream", 1),
    ),
    "onyx-black": (
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 1),
        ("astral-shard", 1),
        ("durovs-cap", 5),
        ("diamond-ring", 2),
        ("neon-dream", 1),
    ),
    "snoop": (
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 1),
        ("astral-shard", 1),
        ("durovs-cap", 4),
        ("diamond-ring", 1),
        ("neon-dream", 1),
    ),
    "peach": (
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 1),
        ("astral-shard", 1),
        ("durovs-cap", 5),
        ("diamond-ring", 2),
        ("neon-dream", 1),
    ),
    "gem": (
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 1),
        ("astral-shard", 1),
        ("durovs-cap", 5),
        ("diamond-ring", 2),
        ("neon-dream", 1),
    ),
    "pepe": (
        ("cyber-helmet", 2),
        ("astral-shard", 1),
        ("durovs-cap", 1),
        ("diamond-ring", 1),
        ("neon-dream", 1),
        ("plush-pepe", 1),
        ("crystal-ball", 1),
    ),
    "cap": (
        ("cyber-helmet", 2),
        ("astral-shard", 1),
        ("durovs-cap", 1),
        ("diamond-ring", 1),
        ("neon-dream", 1),
        ("plush-pepe", 1),
        ("crystal-ball", 1),
    ),
    "ring": (
        ("cyber-helmet", 2),
        ("astral-shard", 1),
        ("durovs-cap", 1),
        ("diamond-ring", 1),
        ("neon-dream", 1),
        ("plush-pepe", 1),
        ("crystal-ball", 1),
    ),
    "black": (
        ("astral-shard", 4),
        ("durovs-cap", 1),
        ("diamond-ring", 1),
        ("neon-dream", 1),
        ("plush-pepe", 3),
        ("crystal-ball", 1),
        ("golden-trophy", 1),
    ),
    "epic": (
        ("durovs-cap", 1),
        ("diamond-ring", 1),
        ("neon-dream", 1),
        ("plush-pepe", 1),
        ("crystal-ball", 4),
        ("golden-trophy", 1),
        ("astral-crown", 1),
    ),
    "vip": (
        ("diamond-ring", 1),
        ("neon-dream", 1),
        ("plush-pepe", 1),
        ("crystal-ball", 1),
        ("golden-trophy", 4),
        ("astral-crown", 1),
    ),
    "elite": (
        ("neon-dream", 1),
        ("plush-pepe", 1),
        ("crystal-ball", 1),
        ("golden-trophy", 1),
        ("astral-crown", 1),
        ("golden-pepe", 4),
    ),
    "free": (
        ("fresh-socks", 1),
        ("scared-cat", 1),
        ("instant-ramen", 1),
        ("chill-flame", 1),
        ("xmas-stocking", 2),
        ("holiday-gift", 2),
        ("heart-locket", 2),
    ),
    "free24": (
        ("holiday-gift", 1),
        ("heart-locket", 1),
        ("magic-potion", 1),
        ("resistance-dog", 1),
        ("cyber-helmet", 1),
        ("astral-shard", 6),
        ("durovs-cap", 2),
        ("diamond-ring", 1),
    ),
}

PAID_CONFIG = [
    ("farm", "Farm", Decimal("0.100"), False, "#46d97b"),
    ("autumn", "Autumn", Decimal("3.500"), True, "#ff9f2e"),
    ("movie", "Movie", Decimal("4.000"), False, "#ff5d5d"),
    ("telegram", "Telegram", Decimal("5.000"), False, "#3ba7ff"),
    ("space", "Space", Decimal("6.000"), False, "#8b5cf6"),
    ("magic", "Magic", Decimal("5.000"), False, "#a855f7"),
    ("kitty", "Kitty", Decimal("5.000"), False, "#ff7ad9"),
    ("adult18", "18+", Decimal("7.000"), False, "#ff4d6d"),
    ("money", "Money", Decimal("8.000"), False, "#2fbf6a"),
    ("onyx-black", "Onyx Black", Decimal("8.000"), False, "#7c5cff"),
    ("snoop", "Snoop", Decimal("7.770"), False, "#ffc93c"),
    ("peach", "Peach", Decimal("8.000"), False, "#ffb07a"),
    ("gem", "Gem", Decimal("8.000"), False, "#38e1ff"),
    ("pepe", "Pepe", Decimal("15.000"), False, "#6ee36e"),
    ("cap", "Cap", Decimal("15.000"), False, "#a3d94c"),
    ("ring", "Ring", Decimal("15.000"), False, "#ffc93c"),
    ("black", "Black", Decimal("20.000"), False, "#6d28d9"),
    ("epic", "Epic", Decimal("40.000"), False, "#8b5cf6"),
    ("vip", "VIP", Decimal("50.000"), True, "#ffc93c"),
    ("elite", "Elite", Decimal("125.000"), True, "#ff9d0b"),
]

CASES_MAP: dict[str, CaseDefinition] = {}

for case_id, name, price, is_new, glow in PAID_CONFIG:
    entries = tuple(CaseEntry(item_id, weight) for item_id, weight in CASE_WEIGHTS[case_id])
    CASES_MAP[case_id] = CaseDefinition(
        id=case_id,
        name=name,
        price_gram=price,
        is_free=False,
        free_cooldown_seconds=None,
        is_new=is_new,
        glow=glow,
        entries=entries,
    )

CASES_MAP["free"] = CaseDefinition(
    id="free",
    name="FREE",
    price_gram=Decimal("0.000"),
    is_free=True,
    free_cooldown_seconds=3600,  # 1 hour
    is_new=False,
    glow="#b7a4f9",
    entries=tuple(CaseEntry(item_id, weight) for item_id, weight in CASE_WEIGHTS["free"]),
)

CASES_MAP["free24"] = CaseDefinition(
    id="free24",
    name="FREE 24",
    price_gram=Decimal("0.000"),
    is_free=True,
    free_cooldown_seconds=86400,  # 24 hours
    is_new=False,
    glow="#ffc93c",
    entries=tuple(CaseEntry(item_id, weight) for item_id, weight in CASE_WEIGHTS["free24"]),
)
