from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field


class DicePlayRequest(BaseModel):
    bet_gram: Decimal = Field(..., ge=Decimal("0.001"), le=Decimal("1000.000"))
    target: int = Field(..., ge=100, le=9899)
    direction: Literal["over", "under"]
    client_request_id: Optional[str] = None


class DicePlayResponse(BaseModel):
    round_id: uuid.UUID
    bet_gram: Decimal
    target: int
    direction: Literal["over", "under"]
    roll: int
    is_win: bool
    multiplier: Decimal
    win_amount: Decimal
    new_balance_gram: Decimal


class MinesStartRequest(BaseModel):
    bet_gram: Decimal = Field(..., ge=Decimal("0.001"), le=Decimal("1000.000"))
    mine_count: int = Field(..., ge=1, le=24)
    client_request_id: Optional[str] = None


class MinesStepRequest(BaseModel):
    tile_index: int = Field(..., ge=0, le=24)


class MinesRoundResponse(BaseModel):
    round_id: uuid.UUID
    status: str
    bet_gram: Decimal
    mine_count: int
    picked_tiles: list[int]
    multiplier: Decimal
    win_amount: Decimal
    revealed_mines: Optional[list[int]] = None
    new_balance_gram: Decimal


class GameHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    game_type: str
    status: str
    bet_amount: Decimal
    win_amount: Decimal
    multiplier: Decimal
    created_at: datetime


class LeaderboardEntry(BaseModel):
    user_id: uuid.UUID
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    total_rounds: int
    wagered_gram: Decimal
    net_profit_gram: Decimal
