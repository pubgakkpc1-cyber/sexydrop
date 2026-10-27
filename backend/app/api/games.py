from __future__ import annotations

from decimal import Decimal
from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_session
from app.models.user import User
from app.schemas.games import (
    DicePlayRequest,
    DicePlayResponse,
    GameHistoryItem,
    LeaderboardEntry,
    MinesRoundResponse,
    MinesStartRequest,
    MinesStepRequest,
)
from app.services.game_service import (
    cashout_mines,
    get_real_leaderboard,
    get_user_game_history,
    play_dice,
    start_mines,
    step_mines,
)
from app.services.ledger_service import InsufficientFundsError, get_user_balance

router = APIRouter(prefix="/api/games", tags=["games"])


@router.post("/dice/play", response_model=DicePlayResponse)
async def play_dice_endpoint(
    payload: DicePlayRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DicePlayResponse:
    try:
        round_obj, new_bal = await play_dice(
            session,
            user_id=current_user.id,
            bet_gram=payload.bet_gram,
            target=payload.target,
            direction=payload.direction,
            client_request_id=payload.client_request_id,
        )
    except InsufficientFundsError as exc:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    state = round_obj.game_state
    return DicePlayResponse(
        round_id=round_obj.id,
        bet_gram=round_obj.bet_amount,
        target=state["target"],
        direction=state["direction"],
        roll=state["roll"],
        is_win=state["is_win"],
        multiplier=round_obj.multiplier,
        win_amount=round_obj.win_amount,
        new_balance_gram=new_bal,
    )


@router.post("/mines/start", response_model=MinesRoundResponse)
async def start_mines_endpoint(
    payload: MinesStartRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MinesRoundResponse:
    try:
        round_obj, new_bal = await start_mines(
            session,
            user_id=current_user.id,
            bet_gram=payload.bet_gram,
            mine_count=payload.mine_count,
            client_request_id=payload.client_request_id,
        )
    except InsufficientFundsError as exc:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    state = round_obj.game_state
    return MinesRoundResponse(
        round_id=round_obj.id,
        status=round_obj.status,
        bet_gram=round_obj.bet_amount,
        mine_count=state["mine_count"],
        picked_tiles=state.get("picked_tiles", []),
        multiplier=round_obj.multiplier,
        win_amount=round_obj.win_amount,
        revealed_mines=state.get("revealed_mines"),
        new_balance_gram=new_bal,
    )


@router.post("/mines/{round_id}/step", response_model=MinesRoundResponse)
async def step_mines_endpoint(
    round_id: uuid.UUID,
    payload: MinesStepRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MinesRoundResponse:
    try:
        round_obj, new_bal = await step_mines(
            session,
            user_id=current_user.id,
            round_id=round_id,
            tile_index=payload.tile_index,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    state = round_obj.game_state
    return MinesRoundResponse(
        round_id=round_obj.id,
        status=round_obj.status,
        bet_gram=round_obj.bet_amount,
        mine_count=state["mine_count"],
        picked_tiles=state.get("picked_tiles", []),
        multiplier=round_obj.multiplier,
        win_amount=round_obj.win_amount,
        revealed_mines=state.get("revealed_mines"),
        new_balance_gram=new_bal,
    )


@router.post("/mines/{round_id}/cashout", response_model=MinesRoundResponse)
async def cashout_mines_endpoint(
    round_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MinesRoundResponse:
    try:
        round_obj, new_bal = await cashout_mines(
            session,
            user_id=current_user.id,
            round_id=round_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    state = round_obj.game_state
    return MinesRoundResponse(
        round_id=round_obj.id,
        status=round_obj.status,
        bet_gram=round_obj.bet_amount,
        mine_count=state["mine_count"],
        picked_tiles=state.get("picked_tiles", []),
        multiplier=round_obj.multiplier,
        win_amount=round_obj.win_amount,
        revealed_mines=state.get("revealed_mines"),
        new_balance_gram=new_bal,
    )


@router.get("/history", response_model=list[GameHistoryItem])
async def get_history(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[GameHistoryItem]:
    rounds = await get_user_game_history(session, current_user.id, limit=limit)
    return [GameHistoryItem.model_validate(r) for r in rounds]


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[LeaderboardEntry]:
    rows = await get_real_leaderboard(session, limit=limit)
    return [LeaderboardEntry.model_validate(r) for r in rows]
