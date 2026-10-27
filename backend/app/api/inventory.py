from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_session
from app.models.user import User
from app.schemas.inventory import (
    InventoryItemRead,
    SellItemRequest,
    SellItemResponse,
)
from app.services.inventory_service import (
    get_user_inventory,
    get_user_inventory_history,
    sell_inventory_item,
)

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/items", response_model=list[InventoryItemRead])
async def list_user_inventory(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[InventoryItemRead]:
    items = await get_user_inventory(session, current_user.id, status="available")
    return [InventoryItemRead.model_validate(item) for item in items]


@router.get("/history", response_model=list[InventoryItemRead])
async def list_inventory_history(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[InventoryItemRead]:
    history = await get_user_inventory_history(session, current_user.id, limit=limit)
    return [InventoryItemRead.model_validate(item) for item in history]


@router.post("/sell", response_model=SellItemResponse)
async def sell_item(
    payload: SellItemRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SellItemResponse:
    try:
        item, tx = await sell_inventory_item(
            session,
            user_id=current_user.id,
            item_id=payload.item_id,
            client_request_id=payload.client_request_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return SellItemResponse(
        item_id=item.id,
        sold_price=item.sold_price or tx.amount,
        new_balance_gram=tx.balance_after,
        transaction_id=tx.id,
    )
