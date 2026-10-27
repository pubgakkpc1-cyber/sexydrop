from __future__ import annotations

from typing import Optional
import uuid

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.catalog import CatalogGift, InventoryItem
from app.models.ledger import Transaction
from app.services.ledger_service import execute_balance_operation


async def get_catalog_gifts(session: AsyncSession) -> list[CatalogGift]:
    stmt = select(CatalogGift).order_by(CatalogGift.price)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_catalog_gift_by_id(session: AsyncSession, gift_id: str) -> Optional[CatalogGift]:
    stmt = select(CatalogGift).where(CatalogGift.id == gift_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_inventory(
    session: AsyncSession,
    user_id: uuid.UUID,
    status: str = "available",
) -> list[InventoryItem]:
    stmt = (
        select(InventoryItem)
        .options(selectinload(InventoryItem.gift))
        .where(InventoryItem.user_id == user_id, InventoryItem.status == status)
        .order_by(desc(InventoryItem.acquired_at))
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_user_inventory_history(
    session: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 50,
) -> list[InventoryItem]:
    stmt = (
        select(InventoryItem)
        .options(selectinload(InventoryItem.gift))
        .where(InventoryItem.user_id == user_id)
        .order_by(desc(InventoryItem.acquired_at))
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def award_gift_to_user(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    gift_id: str,
    acquired_from: str,
    client_request_id: Optional[str] = None,
) -> InventoryItem:
    """Award a catalog gift to the user's inventory with idempotency."""
    if client_request_id:
        stmt_existing = (
            select(InventoryItem)
            .options(selectinload(InventoryItem.gift))
            .where(
                InventoryItem.user_id == user_id,
                InventoryItem.client_request_id == client_request_id,
            )
        )
        res_existing = await session.execute(stmt_existing)
        existing = res_existing.scalar_one_or_none()
        if existing is not None:
            return existing

    gift = await get_catalog_gift_by_id(session, gift_id)
    if gift is None:
        raise ValueError(f"Gift {gift_id} does not exist in catalog")

    item = InventoryItem(
        user_id=user_id,
        gift_id=gift_id,
        status="available",
        acquired_from=acquired_from,
        acquired_price=gift.price,
        client_request_id=client_request_id,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    # Eager load gift relationship
    await session.refresh(item, ["gift"])
    return item


async def sell_inventory_item(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    item_id: uuid.UUID,
    client_request_id: Optional[str] = None,
) -> tuple[InventoryItem, Transaction]:
    """Atomically sell an available item from user's inventory and credit balance."""
    # 1. Lock item row
    stmt_item = (
        select(InventoryItem)
        .options(selectinload(InventoryItem.gift))
        .where(InventoryItem.id == item_id, InventoryItem.user_id == user_id)
        .with_for_update()
    )
    result = await session.execute(stmt_item)
    item = result.scalar_one_or_none()
    if item is None:
        raise ValueError("Item not found in your inventory")
    if item.status != "available":
        raise ValueError(f"Item is not available for sale (status: {item.status})")

    gift = item.gift
    sale_price = gift.price

    # 2. Mark item as sold
    item.status = "sold"
    item.sold_price = sale_price
    item.sold_at = func.now()

    # 3. Credit user's ledger atomically
    tx_req_id = client_request_id or f"sell-{item.id}"
    tx, _is_new = await execute_balance_operation(
        session,
        user_id=user_id,
        type="item_sell",
        direction="credit",
        amount_gram=sale_price,
        client_request_id=tx_req_id,
        description=f"Sold {gift.name} for {sale_price} GRAM",
        metadata={"item_id": str(item.id), "gift_id": gift.id},
    )

    await session.commit()
    await session.refresh(item)
    return item, tx
