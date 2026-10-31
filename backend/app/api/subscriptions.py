from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import validate_telegram_init_data
from app.services import subscription_service

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


class CheckRequest(BaseModel):
    init_data: str = Field(min_length=1, max_length=8192)


@router.post("/check")
async def check_subscriptions(payload: CheckRequest) -> dict[str, Any]:
    """Подписан ли игрок на обязательные каналы. Личность — из подписанного initData."""
    try:
        validated = validate_telegram_init_data(payload.init_data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = validated.get("user") or {}
    if "id" not in user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет данных пользователя")
    return await subscription_service.check(int(user["id"]))
