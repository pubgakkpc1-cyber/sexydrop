from __future__ import annotations

from decimal import Decimal
import time
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import get_settings
from app.core.security import create_access_token
from app.services.inventory_service import get_user_inventory
from app.services.ledger_service import execute_balance_operation, get_user_balance
from app.services.user_service import get_or_create_telegram_user


@pytest.fixture
async def sample_user() -> uuid.UUID:
    engine = create_async_engine(get_settings().database_url)
    tg_id = int(time.time() * 1000) % 1_000_000_000 + 50_000_000
    try:
        async with AsyncSession(engine) as session:
            user = await get_or_create_telegram_user(
                session, telegram_id=tg_id, username=f"cases_user_{tg_id}"
            )
            return user.id
    finally:
        await engine.dispose()


async def test_list_all_cases(client: AsyncClient) -> None:
    resp = await client.get("/api/cases")
    assert resp.status_code == 200
    cases = resp.json()
    assert len(cases) == 22
    case_ids = {c["id"] for c in cases}
    assert "farm" in case_ids
    assert "elite" in case_ids
    assert "free" in case_ids
    assert "free24" in case_ids


async def test_free_case_cooldown_enforcement(client: AsyncClient, sample_user: uuid.UUID) -> None:
    token = create_access_token(sample_user, 999333)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Initial status: can claim
    resp_st = await client.get("/api/cases/free/status", headers=headers)
    assert resp_st.status_code == 200
    statuses = {s["case_id"]: s for s in resp_st.json()}
    assert statuses["free"]["can_claim"] is True
    assert statuses["free"]["cooldown_remaining_seconds"] == 0

    # 2. First claim succeeds with cost 0
    resp_open = await client.post("/api/cases/free/open", headers=headers, json={})
    assert resp_open.status_code == 200
    open_data = resp_open.json()
    assert open_data["case_id"] == "free"
    assert Decimal(open_data["cost_gram"]) == Decimal("0.000")
    assert open_data["winning_gift_id"] is not None

    # 3. Second claim immediately afterwards fails with 400
    resp_open_again = await client.post("/api/cases/free/open", headers=headers, json={})
    assert resp_open_again.status_code == 400
    assert "cooldown" in resp_open_again.json()["detail"].lower()

    # 4. Status reflects cooldown
    resp_st2 = await client.get("/api/cases/free/status", headers=headers)
    assert resp_st2.status_code == 200
    statuses2 = {s["case_id"]: s for s in resp_st2.json()}
    assert statuses2["free"]["can_claim"] is False
    assert statuses2["free"]["cooldown_remaining_seconds"] > 0


async def test_paid_case_opening_and_idempotency(client: AsyncClient, sample_user: uuid.UUID) -> None:
    token = create_access_token(sample_user, 999444)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Opening without funds returns 402 Payment Required
    resp_fail = await client.post("/api/cases/farm/open", headers=headers, json={})
    assert resp_fail.status_code == 402

    # 2. Deposit 1.000 GRAM
    engine = create_async_engine(get_settings().database_url)
    try:
        async with AsyncSession(engine) as session:
            await execute_balance_operation(
                session,
                user_id=sample_user,
                type="deposit",
                direction="credit",
                amount_gram=Decimal("1.000"),
            )
    finally:
        await engine.dispose()

    # 3. Open Farm case (costs 0.100 GRAM) with client_request_id
    req_id = f"case-test-{uuid.uuid4()}"
    resp_open = await client.post(
        "/api/cases/farm/open",
        headers=headers,
        json={"client_request_id": req_id},
    )
    assert resp_open.status_code == 200
    open_data = resp_open.json()
    assert open_data["case_id"] == "farm"
    assert Decimal(open_data["cost_gram"]) == Decimal("0.100")
    assert Decimal(open_data["new_balance_gram"]) == Decimal("0.900")
    assert open_data["is_new_open"] is True
    inv_item_id = open_data["inventory_item_id"]

    # 4. Repeat open request with same client_request_id is idempotent
    resp_dup = await client.post(
        "/api/cases/farm/open",
        headers=headers,
        json={"client_request_id": req_id},
    )
    assert resp_dup.status_code == 200
    dup_data = resp_dup.json()
    assert dup_data["is_new_open"] is False
    assert dup_data["winning_gift_id"] == open_data["winning_gift_id"]
    assert dup_data["inventory_item_id"] == inv_item_id
    assert Decimal(dup_data["new_balance_gram"]) == Decimal("0.900")

    # 5. Check user's inventory contains exactly 1 item
    engine_check = create_async_engine(get_settings().database_url)
    try:
        async with AsyncSession(engine_check) as session:
            inv = await get_user_inventory(session, sample_user)
            assert len(inv) == 1
            bal, _ = await get_user_balance(session, sample_user)
            assert bal == Decimal("0.900")
    finally:
        await engine_check.dispose()
