"""Игры на сервере: кейсы, бесплатные кейсы, апгрейд, мины. Исход решает только сервер."""

from __future__ import annotations

import math
import time
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import catalog
from app.models.economy import NftItem, PlayRound, UserMeta
from app.services import odds_service
from app.services.economy_core import (
    GAME_RTP_PCT,
    MAX_BET_MINOR,
    GameError,
    add_item,
    ensure_account,
    find_round,
    lock_item,
    new_round,
    pick_weighted,
    post_ledger,
    randrange,
)

QUEST_FRIENDS = 5
# FREE 24 (дешёвые подарки каждый день): после стольких прокрутов нужно пополнение, чтобы продолжить
FREE24_SPINS_BEFORE_DEPOSIT = 3
DEPOSIT_UNLOCK_MINOR = 250  # 0.25 TON; 50 Stars = 0.285 TON тоже проходит
QUEST_TTL_MS = 3 * 24 * 3600 * 1000
MINES_TILES = 25
MIN_BET_MINOR = 100  # минимальная ставка в играх — 0.1 TON


def now_ms() -> int:
    return int(time.time() * 1000)


_MSK_OFFSET_MS = 3 * 3600 * 1000
_DAY_MS = 24 * 3600 * 1000


def msk_reset_bounds(now: int) -> tuple[int, int]:
    """Бесплатные кейсы обновляются ежедневно в 23:00 МСК: (последний сброс, следующий сброс) в мс UTC."""
    shifted = now + _MSK_OFFSET_MS
    day_start = shifted - shifted % _DAY_MS  # полночь МСК в «сдвинутой» шкале
    today_23 = day_start + 23 * 3600 * 1000 - _MSK_OFFSET_MS
    if now >= today_23:
        return today_23, today_23 + _DAY_MS
    return today_23 - _DAY_MS, today_23


def free_next_available(last_at: int, now: int) -> int:
    """0 — кейс доступен; иначе время следующего сброса."""
    if last_at <= 0:
        return 0
    last_reset, next_reset = msk_reset_bounds(now)
    return 0 if last_at < last_reset else next_reset


class _Replay(Exception):
    def __init__(self, result: dict[str, Any]) -> None:
        self.result = result


async def _begin(session: AsyncSession, user_id: uuid.UUID, game: str, request_id: str, **kw: Any) -> PlayRound:
    """Создаёт раунд; при повторе того же request_id отдаёт сохранённый результат (_Replay)."""
    existing = await find_round(session, user_id, game, request_id)
    if existing is not None and existing.result is not None:
        raise _Replay(existing.result)
    try:
        async with session.begin_nested():
            return await new_round(session, user_id, game=game, request_id=request_id, **kw)
    except IntegrityError:
        existing = await find_round(session, user_id, game, request_id)
        if existing is not None and existing.result is not None:
            raise _Replay(existing.result) from None
        raise GameError("duplicate_request", 409) from None


def _check_request_id(request_id: str) -> None:
    if not request_id or len(request_id) > 64:
        raise GameError("bad_request_id", 400)


# ---------------------------------------------------------------- кейсы

async def open_case(session: AsyncSession, user_id: uuid.UUID, case_id: str, request_id: str) -> dict[str, Any]:
    _check_request_id(request_id)
    case = catalog.get_case(case_id)
    if case is None:
        raise GameError("unknown_case", 404)
    if case.is_free:
        raise GameError("case_is_free", 400)
    await ensure_account(session, user_id)
    await odds_service.ensure_loaded()
    try:
        round_ = await _begin(session, user_id, "case", request_id, case_id=case_id, bet_minor=case.price)
    except _Replay as replay:
        return replay.result

    await post_ledger(
        session, user_id, type="case_bet", direction="debit", minor=case.price, key=f"{round_.id}:bet",
        description=f"Кейс {case.name}",
    )
    prize = pick_weighted(catalog.effective_entries(case))
    result: dict[str, Any] = {"status": "ok", "gift_id": prize, "uid": ""}
    if catalog.is_ton_prize(prize):
        win = catalog.ton_prize_minor(prize)
        if win > 0:
            await post_ledger(
                session, user_id, type="case_win", direction="credit", minor=win, key=f"{round_.id}:win",
                description=f"Выигрыш {case.name}",
            )
        round_.payout_minor = win
    else:
        price = catalog.gift_price(prize)
        if price is None:
            raise GameError("bad_prize", 500, f"В кейсе {case_id} приз {prize} не найден в каталоге")
        item = await add_item(session, user_id, prize, price, "case-open")
        result["uid"] = str(item.id)
        round_.payout_minor = price
    round_.result = result
    await session.commit()
    return result


# ---------------------------------------------------------------- бесплатные кейсы

async def _lock_meta(session: AsyncSession, user_id: uuid.UUID) -> UserMeta:
    await ensure_account(session, user_id)
    return (
        await session.execute(select(UserMeta).where(UserMeta.user_id == user_id).with_for_update())
    ).scalar_one()


async def _active_quest_item(session: AsyncSession, user_id: uuid.UUID, meta: UserMeta, now: int) -> NftItem | None:
    """Подарок из FREE, ждущий 5 друзей с Premium. Просроченный — сгорает."""
    quest = (meta.free_state or {}).get("quest")
    if not quest:
        return None
    item = (
        await session.execute(
            select(NftItem).where(NftItem.id == uuid.UUID(quest["item_id"]), NftItem.user_id == user_id).with_for_update()
        )
    ).scalar_one_or_none()
    if item is None or item.status != "quest_pending":
        meta.free_state = {k: v for k, v in meta.free_state.items() if k != "quest"}
        return None
    if now >= int(quest["expires_at"]):
        item.status = "expired"
        meta.free_state = {k: v for k, v in meta.free_state.items() if k != "quest"}
        return None
    return item


async def friends_joined(session: AsyncSession, user_id: uuid.UUID, since_ms: int) -> int:
    """Друзья с Telegram Premium, пришедшие по ссылке после `since_ms` и открывшие бесплатный кейс."""
    from datetime import datetime, timezone

    from sqlalchemy import exists, func

    from app.models.user import User

    since = datetime.fromtimestamp(since_ms / 1000, tz=timezone.utc)
    stmt = (
        select(func.count())
        .select_from(User)
        .join(UserMeta, UserMeta.user_id == User.id)
        .where(
            User.referred_by_id == user_id,
            User.created_at >= since,
            UserMeta.is_premium.is_(True),
            exists().where(
                PlayRound.user_id == User.id, PlayRound.game == "case", PlayRound.case_id.in_(("free", "free24"))
            ),
        )
    )
    return int((await session.execute(stmt)).scalar_one())


async def has_unlock_deposit(session: AsyncSession, user_id: uuid.UUID) -> bool:
    """Игрок пополнял баланс (TON, CryptoBot или Stars) минимум на 0.25 TON суммарно."""
    from sqlalchemy import func

    from app.models.economy import DepositOrder

    total = (
        await session.execute(
            select(func.coalesce(func.sum(DepositOrder.amount_minor), 0)).where(
                DepositOrder.user_id == user_id, DepositOrder.status == "paid"
            )
        )
    ).scalar_one()
    return int(total) >= DEPOSIT_UNLOCK_MINOR


async def quest_status(session: AsyncSession, user_id: uuid.UUID) -> dict[str, Any]:
    """Состояние задания FREE; при выполнении подарок переходит в инвентарь."""
    meta = await _lock_meta(session, user_id)
    now = now_ms()
    item = await _active_quest_item(session, user_id, meta, now)
    if item is None:
        await session.commit()
        return {"pending": None, "joined": 0, "target": QUEST_FRIENDS, "completed": False}
    quest = meta.free_state["quest"]
    joined = await friends_joined(session, user_id, int(quest["claimed_at"]))
    completed = joined >= QUEST_FRIENDS
    pending = {
        "uid": str(item.id),
        "gift_id": item.gift_id,
        "expires_at": int(quest["expires_at"]),
        "claimed_at": int(quest["claimed_at"]),
    }
    if completed:
        item.status = "available"
        meta.free_state = {k: v for k, v in meta.free_state.items() if k != "quest"}
    await session.commit()
    return {"pending": pending, "joined": min(joined, QUEST_FRIENDS), "target": QUEST_FRIENDS, "completed": completed}


def _friends_word(n: int) -> str:
    return "друга" if n % 10 == 1 and n % 100 != 11 else "друзей"


async def check_quest_item(session: AsyncSession, user_id: uuid.UUID, item: NftItem, action: str) -> None:
    """Подарок из FREE с замком (quest_pending): вывести/продать/улучшить можно после 5 друзей.

    `item` уже заблокирован вызывающим. Задание выполнено — подарок становится обычным (статус
    available; ключ quest уберёт quest_status). Иначе отказ с реальными числами: сколько друзей
    засчитано и сколько осталось.
    """
    if item.status != "quest_pending":
        return
    meta = (await session.execute(select(UserMeta).where(UserMeta.user_id == user_id))).scalar_one_or_none()
    quest = ((meta.free_state if meta else None) or {}).get("quest") or {}
    if str(quest.get("item_id")) != str(item.id) or now_ms() >= int(quest.get("expires_at", 0)):
        raise GameError("item_unavailable", 409, "Срок задания истёк — подарок больше недоступен")
    joined = min(await friends_joined(session, user_id, int(quest["claimed_at"])), QUEST_FRIENDS)
    if joined >= QUEST_FRIENDS:
        item.status = "available"
        return
    left = QUEST_FRIENDS - joined
    raise GameError(
        "invite_required",
        403,
        f"Чтобы {action}, пригласите ещё {left} {_friends_word(left)} — засчитано {joined} из {QUEST_FRIENDS}",
    )


async def claim_free(session: AsyncSession, user_id: uuid.UUID, case_id: str, request_id: str) -> dict[str, Any]:
    _check_request_id(request_id)
    case = catalog.get_case(case_id)
    if case is None or not case.is_free:
        raise GameError("not_free_case", 400)
    await odds_service.ensure_loaded()
    meta = await _lock_meta(session, user_id)
    try:
        round_ = await _begin(session, user_id, "case", request_id, case_id=case_id, bet_minor=0)
    except _Replay as replay:
        await session.rollback()
        return replay.result
    now = now_ms()
    state = dict(meta.free_state or {})
    last_at = int(state.get(case_id, {}).get("last_at", 0))
    if case_id == "free":
        # дорогой FREE открывается ровно один раз за всё время
        if last_at > 0:
            await session.rollback()
            return {"status": "used"}
    else:
        next_at = free_next_available(last_at, now)
        if next_at:
            await session.rollback()
            return {"status": "cooldown", "next_available_at": next_at}
        spins = int(state.get(case_id, {}).get("count", 0))
        if spins >= FREE24_SPINS_BEFORE_DEPOSIT and not await has_unlock_deposit(session, user_id):
            raise GameError(
                "deposit_required",
                403,
                "Чтобы продолжить бесплатные прокруты, пополните баланс на 50 Stars или 0.25 TON",
            )

    prize = pick_weighted(catalog.effective_entries(case))
    result: dict[str, Any] = {"status": "ok", "gift_id": prize, "uid": ""}
    if catalog.is_ton_prize(prize):
        win = catalog.ton_prize_minor(prize)
        if win > 0:
            await post_ledger(
                session, user_id, type="free_case_win", direction="credit", minor=win, key=f"{round_.id}:win",
                description=f"Бесплатный кейс {case.name}",
            )
        round_.payout_minor = win
    else:
        price = catalog.gift_price(prize)
        if price is None:
            raise GameError("bad_prize", 500, f"В кейсе {case_id} приз {prize} не найден в каталоге")
        if case_id == "free":
            # подарок из обычного FREE выдаётся, когда 5 друзей с Premium откроют бесплатный кейс
            item = await add_item(session, user_id, prize, price, "free-case", status="quest_pending")
            state["quest"] = {"item_id": str(item.id), "claimed_at": now, "expires_at": now + QUEST_TTL_MS}
        else:
            item = await add_item(session, user_id, prize, price, "free-case")
        result["uid"] = str(item.id)
        round_.payout_minor = price
    spins_done = int(state.get(case_id, {}).get("count", 0)) + 1
    state[case_id] = {"last_at": now, "count": spins_done}
    meta.free_state = state
    if case_id == "free24" and spins_done >= FREE24_SPINS_BEFORE_DEPOSIT:
        # после третьего прокрута приложение просит пополнение (игроку об этом заранее не сообщается)
        result["deposit_required"] = not await has_unlock_deposit(session, user_id)
    round_.result = result
    await session.commit()
    return result


# ---------------------------------------------------------------- апгрейд

async def upgrade(
    session: AsyncSession, user_id: uuid.UUID, item_id: str, target_gift_id: str, request_id: str
) -> dict[str, Any]:
    _check_request_id(request_id)
    target_price = catalog.gift_price(target_gift_id)
    if target_price is None or target_price <= 0 or catalog.is_ton_prize(target_gift_id):
        raise GameError("unknown_target", 404)
    await ensure_account(session, user_id)
    try:
        round_ = await _begin(session, user_id, "upgrade", request_id)
    except _Replay as replay:
        return replay.result
    item = await lock_item(session, user_id, item_id)
    await check_quest_item(session, user_id, item, "улучшить подарок")
    if item.status != "available":
        raise GameError("item_unavailable", 409)
    source_price = item.price_minor
    # шанс p = min(1, s/t · 0.98): выигрыш, если randrange(100·t) < 98·s
    won = GAME_RTP_PCT * source_price >= 100 * target_price or randrange(100 * target_price) < GAME_RTP_PCT * source_price
    chance = min(1.0, GAME_RTP_PCT * source_price / (100 * target_price))
    item.status = "burned"
    round_.bet_minor = source_price
    result: dict[str, Any] = {
        "status": "ok",
        "won": won,
        "chance": chance,
        "source_price_minor": source_price,
        "target_price_minor": target_price,
        "gift_id": target_gift_id if won else None,
        "uid": "",
    }
    if won:
        new_item = await add_item(session, user_id, target_gift_id, target_price, "upgrade")
        result["uid"] = str(new_item.id)
        round_.payout_minor = target_price
    round_.result = result
    await session.commit()
    return result


# ---------------------------------------------------------------- мины

def mines_multiplier_hundredths(mines: int, opened: int) -> int:
    if not 1 <= mines <= 24 or not 1 <= opened <= MINES_TILES - mines:
        return 0
    return (GAME_RTP_PCT * math.comb(MINES_TILES, opened)) // math.comb(MINES_TILES - mines, opened)


def _payout(bet: int, mult_h: int) -> int:
    return bet * mult_h // 100


async def _lock_stale_mines(session: AsyncSession, user_id: uuid.UUID, current_id: uuid.UUID) -> list[PlayRound]:
    """Незавершённые раунды игрока, кроме только что созданного."""
    rows = await session.execute(
        select(PlayRound)
        .where(
            PlayRound.user_id == user_id,
            PlayRound.game == "mines",
            PlayRound.status == "active",
            PlayRound.id != current_id,
        )
        .with_for_update()
    )
    return list(rows.scalars())


async def _finish_mines(session: AsyncSession, user_id: uuid.UUID, round_: PlayRound, status: str) -> dict[str, Any]:
    state = round_.state or {}
    picked = len(state.get("picked", []))
    mult_h = mines_multiplier_hundredths(int(state["mines_count"]), picked) if picked else 0
    payout = 0
    if status in ("cashed", "cleared") and picked:
        payout = _payout(round_.bet_minor, mult_h)
        await post_ledger(
            session, user_id, type="mines_win", direction="credit", minor=payout, key=f"{round_.id}:win",
            description="Мины: выплата",
        )
    round_.status = status
    round_.payout_minor = payout
    return {
        "round_id": str(round_.id),
        "picked_count": picked,
        "multiplier_hundredths": mult_h,
        "payout_minor": payout,
        "mine_positions": list(state["mines"]),
    }


async def _settle_abandoned_mines(session: AsyncSession, user_id: uuid.UUID, stale: PlayRound) -> None:
    """Раунд брошен (перезагрузка): открыл клетки — забираем по текущему множителю, не открывал — возвращаем ставку."""
    picked = len((stale.state or {}).get("picked", []))
    if picked:
        await _finish_mines(session, user_id, stale, "cashed")
    else:
        await post_ledger(
            session, user_id, type="mines_refund", direction="credit", minor=stale.bet_minor, key=f"{stale.id}:refund",
            description="Мины: возврат ставки",
        )
        stale.status = "refunded"


async def mines_start(
    session: AsyncSession, user_id: uuid.UUID, bet_minor: int, mines_count: int, request_id: str
) -> dict[str, Any]:
    _check_request_id(request_id)
    if not isinstance(bet_minor, int) or bet_minor < MIN_BET_MINOR or bet_minor > MAX_BET_MINOR:
        raise GameError("invalid_amount", 400)
    if not 1 <= mines_count <= 24:
        raise GameError("invalid_mines", 400)
    await ensure_account(session, user_id)
    try:
        round_ = await _begin(session, user_id, "mines", request_id, bet_minor=bet_minor, status="active")
    except _Replay as replay:
        return replay.result
    for stale in await _lock_stale_mines(session, user_id, round_.id):
        await _settle_abandoned_mines(session, user_id, stale)
    await post_ledger(
        session, user_id, type="mines_bet", direction="debit", minor=bet_minor, key=f"{round_.id}:bet",
        description="Мины: ставка",
    )
    # раскладка: частичный Fisher–Yates на CSPRNG
    deck = list(range(MINES_TILES))
    for i in range(mines_count):
        j = i + randrange(MINES_TILES - i)
        deck[i], deck[j] = deck[j], deck[i]
    mines = sorted(deck[:mines_count])
    round_.state = {"mines": mines, "picked": [], "mines_count": mines_count}
    result = {"status": "ok", "round_id": str(round_.id), "mines_count": mines_count, "bet_minor": bet_minor}
    round_.result = result
    await session.commit()
    return result


async def _get_round_for_update(session: AsyncSession, user_id: uuid.UUID, round_id: str) -> PlayRound:
    try:
        rid = uuid.UUID(round_id)
    except ValueError as exc:
        raise GameError("no_round", 404) from exc
    row = (
        await session.execute(
            select(PlayRound)
            .where(PlayRound.id == rid, PlayRound.user_id == user_id, PlayRound.game == "mines")
            .with_for_update()
        )
    ).scalar_one_or_none()
    if row is None:
        raise GameError("no_round", 404)
    if row.status != "active":
        raise GameError("round_finished", 409)
    return row


async def mines_pick(session: AsyncSession, user_id: uuid.UUID, round_id: str, tile: int) -> dict[str, Any]:
    if not isinstance(tile, int) or not 0 <= tile < MINES_TILES:
        raise GameError("invalid_tile", 400)
    round_ = await _get_round_for_update(session, user_id, round_id)
    state = dict(round_.state or {})
    picked: list[int] = list(state["picked"])
    if tile in picked:
        raise GameError("tile_picked", 409)
    if tile in state["mines"]:
        round_.state = state
        finished = await _finish_mines(session, user_id, round_, "lost")
        finished.update(status="ok", event="lost", picked_count=len(picked), multiplier_hundredths=0, payout_minor=0)
        await session.commit()
        return finished
    picked.append(tile)
    state["picked"] = picked
    round_.state = state
    mult_h = mines_multiplier_hundredths(int(state["mines_count"]), len(picked))
    if len(picked) == MINES_TILES - int(state["mines_count"]):
        finished = await _finish_mines(session, user_id, round_, "cleared")
        finished.update(status="ok", event="cleared")
        await session.commit()
        return finished
    await session.commit()
    return {
        "status": "ok",
        "event": "safe",
        "round_id": str(round_.id),
        "picked_count": len(picked),
        "multiplier_hundredths": mult_h,
        "payout_minor": 0,
        "mine_positions": None,
    }


async def mines_cashout(session: AsyncSession, user_id: uuid.UUID, round_id: str) -> dict[str, Any]:
    round_ = await _get_round_for_update(session, user_id, round_id)
    if not (round_.state or {}).get("picked"):
        raise GameError("nothing_picked", 400)
    finished = await _finish_mines(session, user_id, round_, "cashed")
    finished.update(status="ok", event="cashed")
    await session.commit()
    return finished


async def mines_active(session: AsyncSession, user_id: uuid.UUID) -> dict[str, Any] | None:
    """Незавершённый раунд мин (для восстановления после перезагрузки): без раскладки."""
    row = (
        await session.execute(
            select(PlayRound).where(
                PlayRound.user_id == user_id, PlayRound.game == "mines", PlayRound.status == "active"
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    state = row.state or {}
    return {
        "round_id": str(row.id),
        "bet_minor": row.bet_minor,
        "mines_count": state.get("mines_count"),
        "picked": list(state.get("picked", [])),
    }

