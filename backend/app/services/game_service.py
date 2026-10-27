from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import secrets
from typing import Any, Literal, Optional
import uuid

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.money import GRAM_QUANT, gram_to_minor, minor_to_gram
from app.games.dice import (
    calculate_dice_multiplier,
    evaluate_dice_roll,
    roll_dice,
    validate_dice_target,
)
from app.games.mines import (
    calculate_mines_multiplier,
    generate_mine_positions,
)
from app.models.games import GameRound
from app.models.user import User
from app.services.ledger_service import (
    execute_balance_operation,
    get_user_balance,
)


async def play_dice(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    bet_gram: Decimal,
    target: int,
    direction: Literal["over", "under"],
    client_request_id: Optional[str] = None,
) -> tuple[GameRound, Decimal]:
    validate_dice_target(target, direction)
    if bet_gram <= Decimal("0.000"):
        raise ValueError("Bet amount must be greater than 0")

    # Idempotency check
    if client_request_id:
        stmt_existing = select(GameRound).where(
            GameRound.user_id == user_id,
            GameRound.client_request_id == client_request_id,
        )
        res_existing = await session.execute(stmt_existing)
        existing = res_existing.scalar_one_or_none()
        if existing is not None:
            cur_bal, _ = await get_user_balance(session, user_id)
            return existing, cur_bal

    # 1. Debit bet
    debit_req = f"dice-bet-{client_request_id}" if client_request_id else None
    tx_debit, _ = await execute_balance_operation(
        session,
        user_id=user_id,
        type="game_bet",
        direction="debit",
        amount_gram=bet_gram,
        client_request_id=debit_req,
        description=f"Dice bet {direction} {target}",
        metadata={"game": "dice", "target": target, "direction": direction},
    )

    # 2. Roll & evaluation
    multiplier = calculate_dice_multiplier(target, direction)
    roll = roll_dice()
    is_win = evaluate_dice_roll(target, direction, roll)
    server_seed = secrets.token_hex(16)

    bet_minor = gram_to_minor(bet_gram)
    # Win calculation in minor units floor(bet_minor * m4 / 10000)
    m4 = int(multiplier * 10000)

    if is_win:
        win_minor = (bet_minor * m4) // 10000
        win_gram = minor_to_gram(win_minor)
        credit_req = f"dice-win-{client_request_id}" if client_request_id else None
        tx_win, _ = await execute_balance_operation(
            session,
            user_id=user_id,
            type="game_win",
            direction="credit",
            amount_gram=win_gram,
            client_request_id=credit_req,
            description=f"Dice win roll {roll} ({direction} {target}) x{multiplier}",
            metadata={"game": "dice", "roll": roll, "multiplier": str(multiplier)},
        )
        final_balance = tx_win.balance_after
        status = "won"
    else:
        win_gram = Decimal("0.000")
        final_balance = tx_debit.balance_after
        status = "lost"

    game_round = GameRound(
        user_id=user_id,
        game_type="dice",
        status=status,
        bet_amount=bet_gram,
        win_amount=win_gram,
        multiplier=multiplier,
        client_request_id=client_request_id,
        server_seed=server_seed,
        game_state={
            "target": target,
            "direction": direction,
            "roll": roll,
            "is_win": is_win,
        },
        finished_at=func.now(),
    )
    session.add(game_round)
    await session.commit()
    await session.refresh(game_round)
    return game_round, final_balance


async def start_mines(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    bet_gram: Decimal,
    mine_count: int,
    client_request_id: Optional[str] = None,
) -> tuple[GameRound, Decimal]:
    if not (1 <= mine_count <= 24):
        raise ValueError("mine_count must be between 1 and 24")
    if bet_gram <= Decimal("0.000"):
        raise ValueError("Bet amount must be greater than 0")

    # Check existing active round
    stmt_active = select(GameRound).where(
        GameRound.user_id == user_id,
        GameRound.game_type == "mines",
        GameRound.status == "active",
    )
    res_active = await session.execute(stmt_active)
    if res_active.scalar_one_or_none() is not None:
        raise ValueError("An active Mines round is already in progress. Cash out or finish it first.")

    # Idempotency check
    if client_request_id:
        stmt_existing = select(GameRound).where(
            GameRound.user_id == user_id,
            GameRound.client_request_id == client_request_id,
        )
        res_existing = await session.execute(stmt_existing)
        existing = res_existing.scalar_one_or_none()
        if existing is not None:
            cur_bal, _ = await get_user_balance(session, user_id)
            return existing, cur_bal

    # Debit bet
    debit_req = f"mines-bet-{client_request_id}" if client_request_id else None
    tx_debit, _ = await execute_balance_operation(
        session,
        user_id=user_id,
        type="game_bet",
        direction="debit",
        amount_gram=bet_gram,
        client_request_id=debit_req,
        description=f"Mines start ({mine_count} mines)",
        metadata={"game": "mines", "mine_count": mine_count},
    )

    mine_positions = generate_mine_positions(mine_count)
    server_seed = secrets.token_hex(16)

    game_round = GameRound(
        user_id=user_id,
        game_type="mines",
        status="active",
        bet_amount=bet_gram,
        win_amount=Decimal("0.000"),
        multiplier=Decimal("1.0000"),
        client_request_id=client_request_id,
        server_seed=server_seed,
        game_state={
            "mine_count": mine_count,
            "mine_positions": mine_positions,
            "picked_tiles": [],
        },
    )
    session.add(game_round)
    await session.commit()
    await session.refresh(game_round)
    return game_round, tx_debit.balance_after


async def step_mines(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    round_id: uuid.UUID,
    tile_index: int,
) -> tuple[GameRound, Decimal]:
    if not (0 <= tile_index <= 24):
        raise ValueError("Tile index must be between 0 and 24")

    stmt = select(GameRound).where(
        GameRound.id == round_id,
        GameRound.user_id == user_id,
        GameRound.game_type == "mines",
    ).with_for_update()
    result = await session.execute(stmt)
    game_round = result.scalar_one_or_none()
    if game_round is None:
        raise ValueError("Mines round not found")
    if game_round.status != "active":
        raise ValueError(f"Round is already finished ({game_round.status})")

    state = dict(game_round.game_state)
    mine_positions = state["mine_positions"]
    picked_tiles = list(state.get("picked_tiles", []))

    if tile_index in picked_tiles:
        raise ValueError("Tile already picked")

    picked_tiles.append(tile_index)
    state["picked_tiles"] = picked_tiles

    # Check if hit mine
    if tile_index in mine_positions:
        game_round.status = "lost"
        game_round.win_amount = Decimal("0.000")
        game_round.multiplier = Decimal("0.0000")
        game_round.finished_at = func.now()
        state["revealed_mines"] = mine_positions
        game_round.game_state = state
        await session.commit()
        await session.refresh(game_round)
        cur_bal, _ = await get_user_balance(session, user_id)
        return game_round, cur_bal

    # Safe step
    mine_count = state["mine_count"]
    new_mult = calculate_mines_multiplier(mine_count, len(picked_tiles))
    game_round.multiplier = new_mult

    # Auto cashout if all safe tiles are opened
    safe_total = 25 - mine_count
    if len(picked_tiles) == safe_total:
        bet_minor = gram_to_minor(game_round.bet_amount)
        win_minor = (bet_minor * int(new_mult * 100)) // 100
        win_gram = minor_to_gram(win_minor)
        tx_win, _ = await execute_balance_operation(
            session,
            user_id=user_id,
            type="game_win",
            direction="credit",
            amount_gram=win_gram,
            client_request_id=f"mines-autocashout-{game_round.id}",
            description=f"Mines full sweep x{new_mult}",
            metadata={"round_id": str(game_round.id)},
        )
        game_round.status = "cashed_out"
        game_round.win_amount = win_gram
        game_round.finished_at = func.now()
        state["revealed_mines"] = mine_positions
        game_round.game_state = state
        await session.commit()
        await session.refresh(game_round)
        return game_round, tx_win.balance_after

    game_round.game_state = state
    await session.commit()
    await session.refresh(game_round)
    cur_bal, _ = await get_user_balance(session, user_id)
    return game_round, cur_bal


async def cashout_mines(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    round_id: uuid.UUID,
) -> tuple[GameRound, Decimal]:
    stmt = select(GameRound).where(
        GameRound.id == round_id,
        GameRound.user_id == user_id,
        GameRound.game_type == "mines",
    ).with_for_update()
    result = await session.execute(stmt)
    game_round = result.scalar_one_or_none()
    if game_round is None:
        raise ValueError("Mines round not found")
    if game_round.status != "active":
        raise ValueError(f"Round is already finished ({game_round.status})")

    state = dict(game_round.game_state)
    picked_tiles = state.get("picked_tiles", [])
    if len(picked_tiles) == 0:
        raise ValueError("Must open at least 1 safe tile before cashing out")

    mult = game_round.multiplier
    bet_minor = gram_to_minor(game_round.bet_amount)
    win_minor = (bet_minor * int(mult * 100)) // 100
    win_gram = minor_to_gram(win_minor)

    tx_win, _ = await execute_balance_operation(
        session,
        user_id=user_id,
        type="game_win",
        direction="credit",
        amount_gram=win_gram,
        client_request_id=f"mines-cashout-{game_round.id}",
        description=f"Mines cashout x{mult}",
        metadata={"round_id": str(game_round.id), "steps": len(picked_tiles)},
    )

    game_round.status = "cashed_out"
    game_round.win_amount = win_gram
    game_round.finished_at = func.now()
    state["revealed_mines"] = state["mine_positions"]
    game_round.game_state = state

    await session.commit()
    await session.refresh(game_round)
    return game_round, tx_win.balance_after


async def get_user_game_history(
    session: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 20,
) -> list[GameRound]:
    stmt = (
        select(GameRound)
        .where(GameRound.user_id == user_id)
        .order_by(desc(GameRound.created_at))
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_real_leaderboard(
    session: AsyncSession,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Aggregate real leaderboard directly from users and completed game_rounds."""
    stmt = (
        select(
            User.id,
            User.telegram_id,
            User.username,
            User.first_name,
            func.count(GameRound.id).label("total_rounds"),
            func.sum(GameRound.bet_amount).label("wagered_gram"),
            func.sum(GameRound.win_amount - GameRound.bet_amount).label("net_profit_gram"),
        )
        .join(GameRound, GameRound.user_id == User.id)
        .where(GameRound.status.in_(["won", "lost", "cashed_out"]))
        .group_by(User.id)
        .order_by(desc(func.sum(GameRound.bet_amount)))
        .limit(limit)
    )
    result = await session.execute(stmt)
    rows = result.all()
    return [
        {
            "user_id": r.id,
            "telegram_id": r.telegram_id,
            "username": r.username,
            "first_name": r.first_name,
            "total_rounds": r.total_rounds,
            "wagered_gram": r.wagered_gram or Decimal("0.000"),
            "net_profit_gram": r.net_profit_gram or Decimal("0.000"),
        }
        for r in rows
    ]
