from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
import uuid

from pydantic import BaseModel


class CaseEntryRead(BaseModel):
    gift_id: str
    weight: int
    chance_percent: float


class CaseDefinitionRead(BaseModel):
    id: str
    name: str
    price_gram: Decimal
    is_free: bool
    free_cooldown_seconds: Optional[int] = None
    is_new: bool
    glow: str
    entries: list[CaseEntryRead]


class FreeCaseStatus(BaseModel):
    case_id: str
    can_claim: bool
    cooldown_remaining_seconds: int
    last_claimed_at: Optional[datetime] = None


class OpenCaseRequest(BaseModel):
    client_request_id: Optional[str] = None


class OpenCaseResponse(BaseModel):
    case_id: str
    winning_gift_id: str
    winning_gift_name: str
    winning_gift_image_url: str
    winning_gift_rarity: str
    winning_gift_price_gram: Decimal
    inventory_item_id: uuid.UUID
    cost_gram: Decimal
    new_balance_gram: Decimal
    is_new_open: bool
