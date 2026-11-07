"""Ракетка на сервере: общее расписание раундов, ставки, «Забрать» и авто-вывод считает только сервер."""

from __future__ import annotations

import hashlib
import uuid
from functools import lru_cache
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import catalog
from app.core.config import get_settings
from app.games.crash_schedule import BETTING_MS, TICK_MS, Schedule
from app.models.economy import PlayRound
from app.services.economy_core import (
    MAX_BET_MINOR,
    GameError,
    add_item,
    balance_minor,
    ensure_account,
    lock_item,
    post_ledger,
)
from app.services.play_service import _Replay, _begin, _check_request_id, now_ms

MIN_BET_MINOR = 100
MIN_AUTO = 1.01
MAX_AUTO = 500.0


@lru_cache(maxsize=1)
def _schedule() -> Schedule:
    settings = get_settings()
    seed = settings.bot_token or settings.jwt_secret
    return Schedule(hashlib.sha256(f"sexydrop-crash:{seed}".encode()).digest())


def schedule() -> Schedule:
    return _schedule()


def reset_for_tests() -> None:
    _schedule.cache_clear()


def _mult_h(mult: float) -> int:
    return int(round(mult * 100))


def _bet_payload(row: PlayRound) -> dict[str, Any]:
    state = row.state or {}
    result = row.result or {}
    return {
        "round_id": state.get("round_id"),
        "kind": state.get("kind"),
        "gift_id": state.get("gift_id"),
        "value_minor": row.bet_minor,
        "auto_cashout": state.get("auto"),
        "status": {"active": "active", "won": "won", "lost": "lost"}.get(row.status, row.status),
        "cashed_multiplier": result.get("multiplier"),
        "won_minor": row.payout_minor,
        "won_gift_id": result.get("gift_id"),
    }


async def _active_bets(session: AsyncSession, user_id: uuid.UUID, *, lock: bool = False) -> list[PlayRound]:
    stmt = select(PlayRound).where(
        PlayRound.user_id == user_id, PlayRound.game == "crash", PlayRound.status == "active"
    )
    if lock:
        stmt = stmt.with_for_update()
    return list((await session.execute(stmt)).scalars())


async def _pay(session: AsyncSession, user_id: uuid.UUID, row: PlayRound, mult: float) -> None:
    mult_h = _mult_h(mult)
    payout = row.bet_minor * mult_h // 100
    result: dict[str, Any] = {"status": "ok", "multiplier": mult_h / 100, "won_minor": payout}
    # выплата ровно равна цене NFT — выдаём подарок в инвентарь (как в правилах Ракетки), иначе TON
    options = catalog.gifts_priced(payout) if payout > 0 else []
    if options:
        staked = (row.state or {}).get("gift_id")
        gift_id = staked if staked in options else options[int(uuid.UUID(str(row.id)).int % len(options))]
        item = await add_item(session, user_id, gift_id, payout, "crash-win")
        result.update(gift_id=gift_id, uid=str(item.id), won_gift=True)
    elif payout > 0:
        await post_ledger(
            session, user_id, type="crash_win", direction="credit", minor=payout, key=f"{row.id}:win",
            description=f"Ракетка x{mult:.2f}",
        )
    row.status = "won"
    row.payout_minor = payout
    row.result = result


async def settle(session: AsyncSession, user_id: uuid.UUID, now: int | None = None) -> None:
    """Закрывает ставки игрока: авто-вывод, проигрыш после краша. Коммит — на вызывающем."""
    now = now if now is not None else now_ms()
    rows = await _active_bets(session, user_id, lock=True)
    if not rows:
        return
    sch = schedule()
    cur = sch.at(now)
    for row in rows:
        state = row.state or {}
        rid = int(state["round_id"])
        auto = state.get("auto")
        resolved = sch.resolved(rid, now)
        if resolved is not None:
            if auto is not None and _mult_h(float(auto)) <= _mult_h(resolved.crash_point):
                await _pay(session, user_id, row, float(auto))
            else:
                row.status = "lost"
                row.payout_minor = 0
                row.result = {"status": "lost", "crash_point": resolved.crash_point}
        elif rid == cur["round_id"] and cur["phase"] == "flying" and auto is not None and cur["multiplier"] >= float(auto):
            await _pay(session, user_id, row, float(auto))


async def state(session: AsyncSession, user_id: uuid.UUID | None) -> dict[str, Any]:
    """Расписание на сейчас + ставка игрока (если есть)."""
    now = now_ms()
    sch = schedule()
    out = sch.at(now)
    out["recent"] = sch.recent_crash_points(now, 12)
    out["tick_ms"] = TICK_MS
    out["betting_ms"] = BETTING_MS
    if user_id is not None:
        await ensure_account(session, user_id)
        await settle(session, user_id, now)
        await session.commit()
        row = (
            await session.execute(
                select(PlayRound)
                .where(PlayRound.user_id == user_id, PlayRound.game == "crash")
                .order_by(PlayRound.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        # показываем ставку текущего раунда (или только что закрытую)
        out["my_bet"] = _bet_payload(row) if row is not None and (row.state or {}).get("round_id") == out["round_id"] else None
        out["balance_minor"] = await balance_minor(session, user_id)
    return out


async def place_bet(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    amount_minor: int | None,
    item_id: str | None,
    request_id: str,
    auto_cashout: float | None,
) -> dict[str, Any]:
    _check_request_id(request_id)
    if auto_cashout is not None and not MIN_AUTO <= auto_cashout <= MAX_AUTO:
        raise GameError("invalid_auto", 400)
    await ensure_account(session, user_id)
    now = now_ms()
    cur = schedule().at(now)
    if cur["phase"] != "betting":
        raise GameError("phase", 409, "Ставки принимаются только в окне ставок")
    await settle(session, user_id, now)  # закрываем прошлые ставки: авто-вывод зачисляется до новой ставки
    try:
        round_ = await _begin(session, user_id, "crash", request_id, status="active")
    except _Replay as replay:
        return replay.result
    already = [r for r in await _active_bets(session, user_id, lock=True) if (r.state or {}).get("round_id") == cur["round_id"]]
    if [r for r in already if r.id != round_.id]:
        raise GameError("duplicate", 409, "Ставка в этом раунде уже сделана")
    state_: dict[str, Any] = {"round_id": cur["round_id"], "auto": auto_cashout}
    if item_id is not None:
        item = await lock_item(session, user_id, item_id)
        if item.status != "available":
            raise GameError("item_unavailable", 409)
        if item.price_minor > MAX_BET_MINOR or item.price_minor < MIN_BET_MINOR:
            raise GameError("invalid_amount", 400)
        item.status = "burned"
        round_.bet_minor = item.price_minor
        state_.update(kind="gift", gift_id=item.gift_id, item_id=str(item.id))
    else:
        if amount_minor is None or amount_minor < MIN_BET_MINOR or amount_minor > MAX_BET_MINOR:
            raise GameError("invalid_amount", 400)
        await post_ledger(
            session, user_id, type="crash_bet", direction="debit", minor=amount_minor, key=f"{round_.id}:bet",
            description="Ракетка: ставка",
        )
        round_.bet_minor = amount_minor
        state_["kind"] = "gram"
    round_.state = state_
    result = {"status": "ok", "round_id": cur["round_id"]}
    round_.result = result  # повтор запроса с тем же request_id отдаст то же подтверждение
    await session.commit()
    return result


async def cashout(session: AsyncSession, user_id: uuid.UUID) -> dict[str, Any]:
    await ensure_account(session, user_id)
    now = now_ms()
    await settle(session, user_id, now)
    cur = schedule().at(now)
    rows = [r for r in await _active_bets(session, user_id, lock=True) if (r.state or {}).get("round_id") == cur["round_id"]]
    if not rows:
        await session.commit()
        # авто-вывод мог уже сработать — отдадим итог последней ставки
        last = (
            await session.execute(
                select(PlayRound)
                .where(PlayRound.user_id == user_id, PlayRound.game == "crash", PlayRound.status == "won")
                .order_by(PlayRound.updated_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if last is not None and (last.state or {}).get("round_id") == cur["round_id"]:
            res = last.result or {}
            out = {"status": "ok", "multiplier": res.get("multiplier"), "won_minor": last.payout_minor}
            for k in ("gift_id", "uid"):
                if k in res:
                    out[k] = res[k]
            return out
        raise GameError("no_bet", 409, "Нет активной ставки")
    if cur["phase"] != "flying":
        raise GameError("phase", 409, "Забрать можно только во время полёта")
    row = rows[0]
    await _pay(session, user_id, row, float(cur["multiplier"]))
    await session.commit()
    out = {"status": "ok", "multiplier": row.result["multiplier"], "won_minor": row.payout_minor}
    for k in ("gift_id", "uid"):
        if k in row.result:
            out[k] = row.result[k]
    return out


__all__ = ["state", "place_bet", "cashout", "settle", "schedule", "reset_for_tests"]
