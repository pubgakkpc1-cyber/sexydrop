from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
import uuid

from pydantic import BaseModel, ConfigDict

from app.core.money import gram_to_minor


class CatalogGiftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    image_url: str
    rarity: str
    price: Decimal
    price_source: str
    price_updated_at: datetime
    collection: str
    serial_number: Optional[int] = None
    is_available: bool

    @property
    def price_minor(self) -> int:
        return gram_to_minor(self.price)


class InventoryItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    gift_id: str
    gift: CatalogGiftRead
    status: str
    acquired_from: str
    acquired_price: Decimal
    sold_price: Optional[Decimal] = None
    acquired_at: datetime
    sold_at: Optional[datetime] = None


class SellItemRequest(BaseModel):
    item_id: uuid.UUID
    client_request_id: Optional[str] = None


class SellItemResponse(BaseModel):
    item_id: uuid.UUID
    sold_price: Decimal
    new_balance_gram: Decimal
    transaction_id: uuid.UUID
