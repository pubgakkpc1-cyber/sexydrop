from __future__ import annotations

from decimal import Decimal
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import gram_to_minor, minor_to_gram
from app.games.crash import crash_floor2
from app.models.games import GameRound
from app.services.ledger_service import (
    InsufficientFundsError,
    execute_balance_operation,
    get_user_balance,
)

# Bet limits consistent with the other games (schemas/games.py).
MIN_BET_GRAM = Decimal("0.001")
MAX_BET_GRAM = Decimal("1000.000")


async def place_crash_bet(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    bet_gram: Decimal,
    server_round_id: str,
    client_request_id: Optional[str] = None,
) -> tuple[GameRound, Decimal]:
    """Atomically debit the bet and open a Crash round for the current server round.

    Debit is idempotent per (user_id, client_request_id): a duplicate request
    returns the existing round and current balance without a second charge.
    """
    if bet_gram < MIN_BET_GRAM:
        raise ValueError("Bet amount must be at least 0.001")
    if bet_gram > MAX_BET_GRAM:
        raise ValueError("Bet amount must be at most 1000")
    quantized = bet_gram.quantize(Decimal("0.001"))

    if client_request_id:
        stmt_existing = select(GameRound).where(
            GameRound.user_id == user_id,
            GameRound.client_request_id == client_request_id,
        )
        existing = (await session.execute(stmt_existing)).scalar_one_or_none()
        if existing is not None:
            cur_bal, _ = await get_user_balance(session, user_id)
            return existing, cur_bal

    debit_req = f"crash-bet-{client_request_id}" if client_request_id else None
    tx_debit, _ = await execute_balance_operation(
        session,
        user_id=user_id,
        type="game_bet",
        direction="debit",
        amount_gram=quantized,
        client_request_id=debit_req,
        description=f"Crash bet (server round {server_round_id})",
        metadata={"game": "crash", "server_round_id": server_round_id},
    )

    game_round = GameRound(
        user_id=user_id,
        game_type="crash",
        status="active",
        bet_amount=quantized,
        win_amount=Decimal("0.000"),
        multiplier=Decimal("1.0000"),
        client_request_id=client_request_id,
        server_seed="",
        game_state={"server_round_id": server_round_id, "cashed_out": False},
    )
    session.add(game_round)
    await session.commit()
    await session.refresh(game_round)
    return game_round, tx_debit.balance_after


async def cashout_crash_bet(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    server_round_id: str,
    multiplier: Decimal,
) -> tuple[GameRound, Decimal]:
    """Atomically credit the cashout winnings.

    win = floor(bet_minor * multiplier_hundredths / 100)  (in favour of the house).
    The GameRound row is locked FOR UPDATE so an automatic and a manual cashout
    cannot both pay out the same bet.
    """
    stmt = (
        select(GameRound)
        .where(
            GameRound.user_id == user_id,
            GameRound.game_type == "crash",
            GameRound.status == "active",
        )
        .with_for_update()
    )
    result = await session.execute(stmt)
    game_round = result.scalar_one_or_none()
    if game_round is None:
        # No active crash bet for this user on any open round.
        cur_bal, _ = await get_user_balance(session, user_id)
        return game_round, cur_bal

    state = dict(game_round.game_state)
    if state.get("cashed_out"):
        raise ValueError("Bet already cashed out")

    mult = crash_floor2(multiplier)
    if mult < Decimal("1.00"):
        raise ValueError("Cannot cash out below 1.00")

    bet_minor = gram_to_minor(game_round.bet_amount)
    mult_hundredths = int(mult * 100)
    win_minor = (bet_minor * mult_hundredths) // 100
    win_gram = minor_to_gram(win_minor)

    tx_win, _ = await execute_balance_operation(
        session,
        user_id=user_id,
        type="game_win",
        direction="credit",
        amount_gram=win_gram,
        client_request_id=f"crash-cashout-{game_round.id}",
        description=f"Crash cashout x{mult}",
        metadata={
            "game": "crash",
            "server_round_id": server_round_id,
            "multiplier": str(mult),
        },
    )

    game_round.status = "cashed_out"
    game_round.win_amount = win_gram
    game_round.multiplier = mult
    game_round.finished_at = func.now()
    state["cashed_out"] = True
    state["cashout_multiplier"] = str(mult)
    game_round.game_state = state

    await session.commit()
    await session.refresh(game_round)
    return game_round, tx_win.balance_after


async def finish_crash_bet_lost(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    crash_multiplier: Decimal,
    server_round_id: str,
) -> GameRound | None:
    """Mark an active Crash bet as lost after the round crashed below the multiplier."""
    stmt = (
        select(GameRound)
        .where(
            GameRound.user_id == user_id,
            GameRound.game_type == "crash",
            GameRound.status == "active",
        )
        .with_for_update()
    )
    game_round = (await session.execute(stmt)).scalar_one_or_none()
    if game_round is None:
        return None
    game_round.status = "lost"
    game_round.multiplier = crash_multiplier
    game_round.finished_at = func.now()
    state = dict(game_round.game_state)
    state["crash_multiplier"] = str(crash_multiplier)
    game_round.game_state = state
    await session.commit()
    await session.refresh(game_round)
    return game_round
