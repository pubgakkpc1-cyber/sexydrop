"""Рейтинг-марафон на 30 дней: два топа — «Рефералы» (друзья, открывшие бесплатный кейс) и «Оборот в TON».

- Счёт начинается с момента, когда рейтинг впервые запросили на сервере (дальше сезоны идут подряд по 30 дней).
- В топ считаются только события внутри сезона; админы в рейтинге не участвуют.
- Награда за каждый топ: 1 место — NFT + 10 TON, 2 место — 10 TON, 3 место — 5 TON. TON начисляет админ кнопкой (повтор безопасен), NFT выдаётся вручную.
Начало сезона хранится в app_settings (ключ rating_season), поэтому одинаково для всех экземпляров сервера.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.economy import PlayRound
from app.models.user import User

SEASON_DAYS = 30
TOP_SIZE = 30
KEY = "rating_season"
BOARDS = ("refs", "turnover")
PRIZES: list[dict[str, Any]] = [
    {"place": 1, "ton_minor": 10000, "nft": True},
    {"place": 2, "ton_minor": 10000, "nft": False},
    {"place": 3, "ton_minor": 5000, "nft": False},
]


async def season_start(session: AsyncSession) -> datetime:
    """Начало первого сезона: момент первого запроса (создаётся один раз)."""
    await session.execute(
        text("INSERT INTO app_settings (key, value) VALUES (:k, CAST(:v AS jsonb)) ON CONFLICT (key) DO NOTHING"),
        {"k": KEY, "v": json.dumps({"start": time.time()})},
    )
    raw = (await session.execute(text("SELECT value FROM app_settings WHERE key = :k"), {"k": KEY})).scalar_one()
    data = json.loads(raw) if isinstance(raw, str) else raw
    await session.commit()
    return datetime.fromtimestamp(float(data["start"]), tz=timezone.utc)


def index_at(start: datetime, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    return max(0, int((now - start) // timedelta(days=SEASON_DAYS)))


def window(start: datetime, index: int) -> tuple[datetime, datetime]:
    return start + timedelta(days=SEASON_DAYS * index), start + timedelta(days=SEASON_DAYS * (index + 1))


def _admin_ids():
    from app.api.odds import ADMIN_USERNAMES

    return select(User.id).where(func.lower(func.coalesce(User.username, "")).in_(sorted(ADMIN_USERNAMES)))


async def standings(session: AsyncSession, board: str, start: datetime, end: datetime) -> list[dict[str, Any]]:
    """Полный список игроков с положительным результатом, по убыванию."""
    from app.services.clicker import _display

    admins = _admin_ids()
    if board == "turnover":
        rows = (
            await session.execute(
                select(PlayRound.user_id, func.coalesce(func.sum(PlayRound.bet_minor), 0))
                .where(PlayRound.status != "active", PlayRound.created_at >= start, PlayRound.created_at < end, PlayRound.user_id.not_in(admins))
                .group_by(PlayRound.user_id)
            )
        ).all()
    else:
        counted = (
            select(PlayRound.id)
            .where(PlayRound.user_id == User.id, PlayRound.game == "case", PlayRound.case_id.in_(("free", "free24")))
            .exists()
        )
        rows = (
            await session.execute(
                select(User.referred_by_id, func.count(User.id))
                .where(
                    User.referred_by_id.is_not(None),
                    User.referred_by_id.not_in(admins),
                    User.created_at >= start,
                    User.created_at < end,
                    counted,
                )
                .group_by(User.referred_by_id)
            )
        ).all()
    values = {uid: int(v) for uid, v in rows if int(v) > 0}
    if not values:
        return []
    users = {u.id: u for u in (await session.execute(select(User).where(User.id.in_(list(values))))).scalars().all()}
    out = []
    for uid, v in values.items():
        u = users.get(uid)
        if u is None:
            continue
        photo = u.photo_url if (u.photo_url or "").startswith("https://") else None
        out.append({"user_id": uid, "name": _display(u.first_name, u.last_name), "username": u.username, "avatar": photo, "value": v})
    out.sort(key=lambda r: (-r["value"], str(r["user_id"])))
    return out


def _board_view(rows: list[dict[str, Any]], me_id) -> dict[str, Any]:
    top = [
        {"rank": i + 1, "name": r["name"], "avatar": r["avatar"], "value": r["value"], "me": r["user_id"] == me_id}
        for i, r in enumerate(rows[:TOP_SIZE])
    ]
    mine = next(((i + 1, r) for i, r in enumerate(rows) if r["user_id"] == me_id), None)
    outside = (
        {"rank": mine[0], "name": mine[1]["name"], "avatar": mine[1]["avatar"], "value": mine[1]["value"], "me": True}
        if mine and mine[0] > TOP_SIZE
        else None
    )
    return {"top": top, "me": {"rank": mine[0], "value": mine[1]["value"]} if mine else None, "me_outside": outside, "players": len(rows)}


async def state(session: AsyncSession, user: User) -> dict[str, Any]:
    start = await season_start(session)
    idx = index_at(start)
    s, e = window(start, idx)
    boards = {b: _board_view(await standings(session, b, s, e), user.id) for b in BOARDS}
    return {
        "season": {"index": idx, "starts_at": int(s.timestamp()), "ends_at": int(e.timestamp()), "days": SEASON_DAYS},
        "prizes": PRIZES,
        "boards": boards,
    }


async def last_finished_index(session: AsyncSession) -> int | None:
    idx = index_at(await season_start(session))
    return idx - 1 if idx >= 1 else None


async def pay_season(session: AsyncSession, index: int) -> list[dict[str, Any]]:
    """Начисляет TON призёрам обоих топов завершённого сезона (один раз на место и топ: идемпотентно по ключу проводки)."""
    from app.services.economy_core import post_ledger

    start = await season_start(session)
    s, e = window(start, index)
    paid: list[dict[str, Any]] = []
    for board in BOARDS:
        rows = (await standings(session, board, s, e))[: len(PRIZES)]
        for prize, row in zip(PRIZES, rows):
            await post_ledger(
                session, row["user_id"], type="rating_prize", direction="credit", minor=int(prize["ton_minor"]),
                key=f"rating:{board}:{index}:{prize['place']}", description=f"Рейтинг ({board}), сезон {index}: {prize['place']} место",
            )
            paid.append({"board": board, "place": prize["place"], "name": row["name"], "username": row["username"], "ton_minor": prize["ton_minor"], "nft": prize["nft"], "value": row["value"]})
    await session.commit()
    return paid
