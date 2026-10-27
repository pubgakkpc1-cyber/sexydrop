from __future__ import annotations

from decimal import Decimal
import time
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import get_settings
from app.core.security import create_access_token
from app.services.inventory_service import (
    award_gift_to_user,
    get_catalog_gifts,
    get_user_inventory,
)
from app.services.ledger_service import get_user_balance
from app.services.user_service import get_or_create_telegram_user


@pytest.fixture
async def sample_user() -> uuid.UUID:
    engine = create_async_engine(get_settings().database_url)
    tg_id = int(time.time() * 1000) % 1_000_000_000 + 40_000_000
    try:
        async with AsyncSession(engine) as session:
            user = await get_or_create_telegram_user(
                session, telegram_id=tg_id, username=f"inv_user_{tg_id}"
            )
            return user.id
    finally:
        await engine.dispose()


async def test_catalog_seeded_correctly() -> None:
    engine = create_async_engine(get_settings().database_url)
    try:
        async with AsyncSession(engine) as session:
            gifts = await get_catalog_gifts(session)
            assert len(gifts) == 19
            gift_map = {g.id: g for g in gifts}
            assert "fresh-socks" in gift_map
            assert gift_map["fresh-socks"].price == Decimal("0.050")
            assert gift_map["fresh-socks"].rarity == "common"
            assert "golden-pepe" in gift_map
            assert gift_map["golden-pepe"].price == Decimal("200.000")
            assert gift_map["golden-pepe"].rarity == "legendary"
    finally:
        await engine.dispose()


async def test_inventory_award_and_sell_cycle(sample_user: uuid.UUID) -> None:
    engine = create_async_engine(get_settings().database_url)
    try:
        async with AsyncSession(engine) as session:
            # 1. Initial inventory is empty
            initial_items = await get_user_inventory(session, sample_user)
            assert len(initial_items) == 0

            # 2. Award fresh-socks (price 0.050)
            item1 = await award_gift_to_user(
                session,
                user_id=sample_user,
                gift_id="fresh-socks",
                acquired_from="free_case",
                client_request_id="award-test-1",
            )
            assert item1.status == "available"
            assert item1.gift.name == "Fresh Socks"

            # 3. Repeat award with same client_request_id is idempotent
            item1_dup = await award_gift_to_user(
                session,
                user_id=sample_user,
                gift_id="fresh-socks",
                acquired_from="free_case",
                client_request_id="award-test-1",
            )
            assert item1_dup.id == item1.id

            items_now = await get_user_inventory(session, sample_user)
            assert len(items_now) == 1
    finally:
        await engine.dispose()


async def test_inventory_api_sell_flow(client: AsyncClient, sample_user: uuid.UUID) -> None:
    token = create_access_token(sample_user, 999222)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Award heart-locket (1.000 GRAM) to user
    engine = create_async_engine(get_settings().database_url)
    try:
        async with AsyncSession(engine) as session:
            item = await award_gift_to_user(
                session,
                user_id=sample_user,
                gift_id="heart-locket",
                acquired_from="case_open",
            )
            item_id = item.id
    finally:
        await engine.dispose()

    # 2. Check /api/inventory/items returns item
    resp_items = await client.get("/api/inventory/items", headers=headers)
    assert resp_items.status_code == 200
    items = resp_items.json()
    assert len(items) == 1
    assert items[0]["gift_id"] == "heart-locket"
    assert items[0]["gift"]["name"] == "Heart Locket"

    # 3. Sell item via /api/inventory/sell
    resp_sell = await client.post(
        "/api/inventory/sell",
        headers=headers,
        json={"item_id": str(item_id)},
    )
    assert resp_sell.status_code == 200
    sell_data = resp_sell.json()
    assert Decimal(sell_data["sold_price"]) == Decimal("1.000")
    assert Decimal(sell_data["new_balance_gram"]) == Decimal("1.000")

    # 4. Active inventory is now empty
    resp_items_after = await client.get("/api/inventory/items", headers=headers)
    assert resp_items_after.status_code == 200
    assert len(resp_items_after.json()) == 0

    # 5. History retains sold item
    resp_hist = await client.get("/api/inventory/history", headers=headers)
    assert resp_hist.status_code == 200
    assert len(resp_hist.json()) == 1
    assert resp_hist.json()[0]["status"] == "sold"

    # 6. Selling again returns 400 Bad Request
    resp_sell_again = await client.post(
        "/api/inventory/sell",
        headers=headers,
        json={"item_id": str(item_id)},
    )
    assert resp_sell_again.status_code == 400
