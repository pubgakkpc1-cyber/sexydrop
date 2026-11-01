"""Статистика проекта для админ-панели — считается из записей игр и пополнений в Postgres (переживает деплой)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import case as sql_case
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.economy import DepositOrder, PlayRound
from app.models.user import User

_FINISHED = PlayRound.status != "active"
_METHOD = {"cryptobot": "crypto", "ton": "ton", "stars": "stars"}


async def users_snapshot(session: AsyncSession) -> dict[str, dict[str, Any]]:
    """Игроки: telegram id → first/last (сек), имя, оборот, результат, число раундов. Для рассылок и списка в админке."""
    stats = (
        select(
            PlayRound.user_id.label("uid"),
            func.coalesce(func.sum(PlayRound.bet_minor), 0).label("wagered"),
            func.coalesce(func.sum(PlayRound.payout_minor), 0).label("paid"),
            func.count().label("events"),
        )
        .where(_FINISHED)
        .group_by(PlayRound.user_id)
        .subquery()
    )
    rows = (
        await session.execute(
            select(User, stats.c.wagered, stats.c.paid, stats.c.events).outerjoin(stats, stats.c.uid == User.id)
        )
    ).all()
    out: dict[str, dict[str, Any]] = {}
    for user, wagered, paid, events in rows:
        wagered, paid = int(wagered or 0), int(paid or 0)
        out[str(user.telegram_id)] = {
            "first": int(user.created_at.timestamp()),
            "last": int((user.updated_at or user.created_at).timestamp()),
            "name": user.username or user.first_name,
            "wagered": wagered,
            "delta": paid - wagered,
            "events": int(events or 0),
        }
    return out


async def snapshot(session: AsyncSession) -> dict[str, Any]:
    """Сводка для админки: итоги, таблицы по играм/кейсам/пополнениям, динамика за 14 дней."""
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)

    users_total = (await session.execute(select(func.count()).select_from(User))).scalar_one()
    users_24h = (
        await session.execute(select(func.count()).select_from(User).where(User.updated_at >= day_ago))
    ).scalar_one()
    users_new_24h = (
        await session.execute(select(func.count()).select_from(User).where(User.created_at >= day_ago))
    ).scalar_one()

    games_rows = (
        await session.execute(
            select(
                PlayRound.game,
                func.count(),
                func.coalesce(func.sum(PlayRound.bet_minor), 0),
                func.coalesce(func.sum(PlayRound.payout_minor), 0),
                func.coalesce(func.sum(sql_case((PlayRound.payout_minor > PlayRound.bet_minor, 1), else_=0)), 0),
            )
            .where(_FINISHED, PlayRound.game != "case")
            .group_by(PlayRound.game)
            .order_by(PlayRound.game)
        )
    ).all()
    games = [
        {"game": g, "rounds": int(n), "wagered": int(w), "delta": int(p) - int(w), "wins": int(wins)}
        for g, n, w, p, wins in games_rows
    ]
    case_rows = (
        await session.execute(
            select(
                PlayRound.case_id,
                func.count(),
                func.coalesce(func.sum(PlayRound.bet_minor), 0),
                func.coalesce(func.sum(PlayRound.payout_minor), 0),
            )
            .where(PlayRound.game == "case", PlayRound.case_id.is_not(None))
            .group_by(PlayRound.case_id)
            .order_by(func.count().desc())
        )
    ).all()
    cases = [{"case": c, "opens": int(n), "spent": int(s), "prize": int(p)} for c, n, s, p in case_rows]

    deposit_rows = (
        await session.execute(
            select(DepositOrder.provider, func.count(), func.coalesce(func.sum(DepositOrder.amount_minor), 0))
            .where(DepositOrder.status == "paid")
            .group_by(DepositOrder.provider)
        )
    ).all()
    deposits = [{"method": _METHOD.get(p, p), "count": int(n), "amount": int(a)} for p, n, a in sorted(deposit_rows)]

    wagered = sum(g["wagered"] for g in games) + sum(c["spent"] for c in cases)
    player_net = sum(g["delta"] for g in games) + sum(c["prize"] - c["spent"] for c in cases)

    since = now - timedelta(days=14)
    day = func.date_trunc("day", PlayRound.created_at).label("d")
    day_rows = (
        await session.execute(
            select(day, func.count(), func.count(func.distinct(PlayRound.user_id)))
            .where(PlayRound.created_at >= since)
            .group_by(day)
            .order_by(day)
        )
    ).all()
    new_day = func.date_trunc("day", User.created_at).label("d")
    new_rows = dict(
        (
            await session.execute(
                select(new_day, func.count()).where(User.created_at >= since).group_by(new_day)
            )
        ).all()
    )
    series = [
        {"day": d.strftime("%Y-%m-%d"), "events": int(n), "users": int(u), "new": int(new_rows.get(d, 0))}
        for d, n, u in day_rows
    ]

    top_rows = (
        await session.execute(
            select(
                User.telegram_id,
                User.username,
                User.first_name,
                func.coalesce(func.sum(PlayRound.bet_minor), 0).label("w"),
                func.coalesce(func.sum(PlayRound.payout_minor), 0).label("p"),
                func.count(),
            )
            .join(PlayRound, PlayRound.user_id == User.id)
            .where(_FINISHED)
            .group_by(User.id)
            .order_by(func.sum(PlayRound.bet_minor).desc())
            .limit(10)
        )
    ).all()
    first_round = (await session.execute(select(func.min(PlayRound.created_at)))).scalar_one()
    return {
        "since": int((first_round or now).timestamp()),
        "users_total": int(users_total),
        "users_24h": int(users_24h),
        "users_new_24h": int(users_new_24h),
        "wagered": int(wagered),
        "house_profit": -int(player_net),
        "games": games,
        "cases": cases,
        "deposits": deposits,
        "series": series,
        "top": [
            {"id": str(tg), "name": username or first_name, "wagered": int(w), "delta": int(p) - int(w), "events": int(n)}
            for tg, username, first_name, w, p, n in top_rows
        ],
    }
