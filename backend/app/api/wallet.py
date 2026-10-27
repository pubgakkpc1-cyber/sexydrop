from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_session
from app.models.ledger import Transaction
from app.models.user import User
from app.schemas.wallet import BalanceResponse, DemoDepositRequest, TransactionRead
from app.services.ledger_service import (
    execute_balance_operation,
    get_user_balance,
)

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BalanceResponse:
    balance_gram, balance_minor = await get_user_balance(session, current_user.id)
    return BalanceResponse(
        balance_gram=balance_gram,
        balance_minor=balance_minor,
        currency="GRAM",
    )


@router.get("/transactions", response_model=list[TransactionRead])
async def get_transactions(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[TransactionRead]:
    stmt = (
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(desc(Transaction.created_at))
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    records = result.scalars().all()
    return [TransactionRead.model_validate(r) for r in records]


@router.post("/demo-deposit", response_model=TransactionRead)
async def demo_deposit(
    payload: DemoDepositRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TransactionRead:
    settings = get_settings()
    if settings.app_env == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo deposit is disabled in production",
        )

    tx, _is_new = await execute_balance_operation(
        session,
        user_id=current_user.id,
        type="demo_deposit",
        direction="credit",
        amount_gram=payload.amount_gram,
        client_request_id=payload.client_request_id,
        description=f"Demo deposit of {payload.amount_gram} GRAM",
    )
    return TransactionRead.model_validate(tx)
