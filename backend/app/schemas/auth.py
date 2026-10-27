from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.user import UserRead


class TelegramAuthRequest(BaseModel):
    init_data: str = Field(description="Raw Telegram WebApp.initData query string")
    referral_code: Optional[str] = Field(default=None, description="Optional referral code (e.g. ref-12345)")


class DevAuthRequest(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    photo_url: Optional[str] = None
    referral_code: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserRead
