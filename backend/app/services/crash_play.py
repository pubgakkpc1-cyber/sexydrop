"""Ракетка на сервере: общее расписание раундов, ставки, «Забрать» и авто-вывод считает только сервер."""

from __future__ import annotations

import hashlib
import json
import math
import secrets
import time
import uuid
from functools import lru_cache
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import catalog
from app.core.config import get_settings
from app.services import prize_bank
from app.games.crash_schedule import BETTING_MS, TICK_MS, WINDOW_MS, Schedule
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


_decided: set[int] = set()
_loaded_at: dict[int, float] = {}
BANK_FORCED_MAX = 30  # ставка больше банка: раунд «сливается» на иксах 1.00–1.30


def reset_for_tests() -> None:
    _schedule.cache_clear()
    _decided.clear()
    _loaded_at.clear()


def _floor2(x: float) -> float:
    return math.floor(x * 100) / 100


async def load_overrides(session: AsyncSession, round_id: int) -> None:
    """Подтягивает из базы точки краша, сниженные банком, для окна этого раунда (кэш ~1 с, общий для всех экземпляров сервера)."""
    w = round_id // 1000
    now = time.monotonic()
    if now - _loaded_at.get(w, -10.0) < 1.0:
        return
    rows = (await session.execute(text("SELECT key, value FROM app_settings WHERE key LIKE :p"), {"p": f"crash_cp:{w}%"})).all()
    for key, raw in rows:
        data = json.loads(raw) if isinstance(raw, str) else raw
        cp = (data or {}).get("cp")
        if cp is not None:
            schedule().set_override(int(key.split(":")[1]), float(cp))
    _loaded_at[w] = now


async def ensure_decided(session: AsyncSession, round_id: int) -> None:
    """В начале полёта раунда решает, до какого икса он может дойти с учётом ставок и «Банка призов».

    - ставок нет или банк выключен — раунд как обычно;
    - ставки в сумме не больше банка — раунд как обычно, но не выше икса банк / сумма ставок (выплата не превысит банк);
    - ставки в сумме больше банка — раунд «сливается» на иксах 1.00–1.30.
    Решение сохраняется (одно на раунд, под блокировкой банка), чтобы все экземпляры сервера видели одно и то же.
    """
    if round_id in _decided or not prize_bank.enabled():
        return
    sch = schedule()
    total, count = (
        await session.execute(
            text("SELECT COALESCE(SUM(bet_minor), 0), COUNT(*) FROM play_rounds WHERE game = 'crash' AND (state->>'round_id') = :r"),
            {"r": str(round_id)},
        )
    ).one()
    if not count:
        _decided.add(round_id)
        return
    bank = await prize_bank.available(session)  # блокировка банка: решения и выплаты идут по очереди
    key = f"crash_cp:{round_id}"
    raw = (await session.execute(text("SELECT value FROM app_settings WHERE key = :k"), {"k": key})).scalar_one_or_none()
    if raw is not None:
        data = json.loads(raw) if isinstance(raw, str) else raw
        if data.get("cp") is not None:
            sch.set_override(round_id, float(data["cp"]))
        _decided.add(round_id)
        return
    natural = sch.natural_crash_point(round_id)
    total = int(total)
    if total > bank:
        cp = min(natural, 1.0 + secrets.randbelow(BANK_FORCED_MAX + 1) / 100)
    else:
        cp = min(natural, max(1.0, _floor2(bank / total)))
    await session.execute(
        text("INSERT INTO app_settings (key, value) VALUES (:k, CAST(:v AS jsonb)) ON CONFLICT (key) DO NOTHING"),
        {"k": key, "v": json.dumps({"cp": cp if cp < natural else None, "natural": natural, "bank": bank, "bets": total})},
    )
    if cp < natural:
        sch.set_override(round_id, cp)
    _decided.add(round_id)


async def sync_schedule(session: AsyncSession, now: int) -> None:
    """Перед любым чтением расписания: подтянуть сниженные точки краша и принять решения по раундам с начавшимся полётом."""
    sch = schedule()
    for _ in range(3):
        cur = sch.at(now)
        await load_overrides(session, cur["round_id"])
        cur = sch.at(now)
        pending = (
            await session.execute(
                text("SELECT DISTINCT (state->>'round_id')::bigint FROM play_rounds WHERE game = 'crash' AND status = 'active'")
            )
        ).scalars().all()
        todo = [int(r) for r in pending if int(r) not in _decided and (int(r) < cur["round_id"] or (int(r) == cur["round_id"] and cur["phase"] != "betting"))]
        if cur["phase"] != "betting" and cur["round_id"] not in _decided:
            todo.append(cur["round_id"])
        if not todo:
            return
        for rid in sorted(set(todo)):
            await ensure_decided(session, rid)


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
    payout = await prize_bank.cap_payout(session, row.bet_minor, row.bet_minor * mult_h // 100)
    result: dict[str, Any] = {"status": "ok", "multiplier": mult_h / 100, "won_minor": payout}
    # Ракетка платит только TON: NFT за выигрыш не выдаётся (решение владельца)
    options: list[str] = []  # NFT за выигрыш в Ракетке отключены
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
    await sync_schedule(session, now)
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
    await sync_schedule(session, now)
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
    await sync_schedule(session, now)
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
    await sync_schedule(session, now)
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
