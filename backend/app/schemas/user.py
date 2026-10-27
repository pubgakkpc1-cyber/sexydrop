from __future__ import annotations

from datetime import datetime
from typing import Optional
import uuid

from pydantic import BaseModel, ConfigDict


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    photo_url: Optional[str] = None
    referral_code: str
    referred_by_id: Optional[uuid.UUID] = None
    created_at: datetime
