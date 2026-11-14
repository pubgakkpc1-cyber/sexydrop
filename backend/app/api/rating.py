from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_session
from app.models.user import User
from app.services import rating

router = APIRouter(prefix="/api/rating", tags=["rating"])


@router.get("/state")
async def rating_state(user: Annotated[User, Depends(get_current_user)], session: Annotated[AsyncSession, Depends(get_session)]) -> dict[str, Any]:
    """Рейтинг-марафон: сезон 30 дней, топы «Рефералы» и «Оборот», призы."""
    return await rating.state(session, user)
