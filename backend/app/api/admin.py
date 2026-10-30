from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import _bearer
from app.core.db import get_session
from app.core.security import decode_access_token
from app.models.ledger import Account, Transaction
from app.models.user import User
from app.services.ledger_service import execute_balance_operation, get_user_balance
from app.services.user_service import get_user_by_id

router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_USERNAMES = {"zapixxgarant"}


class GiveTonRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    amount_ton: Decimal = Field(..., gt=0, le=1000000)
    description: Optional[str] = "Выдача администратором @zapixxgarant"


class GiveTonResponse(BaseModel):
    ok: bool = True
    username: str
    telegram_id: int
    amount_credited: str
    new_balance: str
    currency: str = "TON"


class AdminUserItem(BaseModel):
    id: uuid.UUID
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    balance_ton: str
    created_at: str


async def verify_admin(
    credentials: Annotated[Optional[object], Depends(_bearer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> str:
    # Admin rights come only from a signed Bearer JWT; client headers are never trusted.
    if credentials and getattr(credentials, "credentials", None):
        try:
            payload = decode_access_token(credentials.credentials)
            sub = payload.get("sub")
            if sub:
                user = await get_user_by_id(session, uuid.UUID(str(sub)))
                if user and user.username and user.username.lower().lstrip("@") in ADMIN_USERNAMES:
                    return user.username.lower().lstrip("@")
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Доступ запрещён. Требуются права администратора (@zapixxgarant).",
    )


@router.post("/give-ton", response_model=GiveTonResponse)
async def give_ton(
    body: GiveTonRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    admin_name: Annotated[str, Depends(verify_admin)],
) -> GiveTonResponse:
    clean_username = body.username.lstrip("@").strip().lower()
    stmt = select(User).where(func.lower(User.username) == clean_username)
    result = await session.execute(stmt)
    target_user = result.scalar_one_or_none()

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь @{clean_username} не найден в базе данных. Попросите его сначала открыть бота @sexydropbot.",
        )

    # Credit target user balance atomically
    await execute_balance_operation(
        session,
        user_id=target_user.id,
        type="admin_credit",
        direction="credit",
        amount_gram=body.amount_ton,
        description=body.description or f"Выдача администратором @{admin_name}",
        metadata={"admin": admin_name, "recipient_username": target_user.username},
    )
    await session.commit()

    balance_gram, _ = await get_user_balance(session, target_user.id)

    return GiveTonResponse(
        ok=True,
        username=target_user.username or clean_username,
        telegram_id=target_user.telegram_id,
        amount_credited=str(body.amount_ton),
        new_balance=str(balance_gram),
        currency="TON",
    )


@router.get("/users", response_model=list[AdminUserItem])
async def list_users(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin_name: Annotated[str, Depends(verify_admin)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[AdminUserItem]:
    stmt = (
        select(User, Account.balance)
        .outerjoin(Account, Account.user_id == User.id)
        .order_by(desc(User.created_at))
        .limit(limit)
    )
    result = await session.execute(stmt)
    rows = result.all()

    items: list[AdminUserItem] = []
    for user, balance in rows:
        bal_str = str(balance) if balance is not None else "0.000"
        items.append(
            AdminUserItem(
                id=user.id,
                telegram_id=user.telegram_id,
                username=user.username,
                first_name=user.first_name,
                balance_ton=bal_str,
                created_at=user.created_at.isoformat(),
            )
        )
    return items
