from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field


class BalanceResponse(BaseModel):
    balance_gram: Decimal
    balance_minor: int
    currency: Literal["GRAM"] = "GRAM"


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    direction: Literal["credit", "debit"]
    amount: Decimal
    balance_after: Decimal
    client_request_id: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime


class DemoDepositRequest(BaseModel):
    amount_gram: Decimal = Field(default=Decimal("100.000"), ge=Decimal("0.001"), le=Decimal("10000.000"))
    client_request_id: Optional[str] = None
