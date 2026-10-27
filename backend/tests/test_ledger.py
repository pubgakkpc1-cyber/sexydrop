from __future__ import annotations

from decimal import Decimal
import time
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import get_settings
from app.core.security import create_access_token
from app.services.ledger_service import (
    InsufficientFundsError,
    execute_balance_operation,
    get_user_balance,
)
from app.services.user_service import get_or_create_telegram_user


@pytest.fixture
async def sample_user() -> uuid.UUID:
    engine = create_async_engine(get_settings().database_url)
    tg_id = int(time.time() * 1000) % 1_000_000_000 + 30_000_000
    try:
        async with AsyncSession(engine) as session:
            user = await get_or_create_telegram_user(session, telegram_id=tg_id, username=f"user_{tg_id}")
            return user.id
    finally:
        await engine.dispose()


async def test_ledger_credit_and_debit_flow(sample_user: uuid.UUID) -> None:
    engine = create_async_engine(get_settings().database_url)
    try:
        async with AsyncSession(engine) as session:
            # 1. Initial balance 0
            balance_gram, balance_minor = await get_user_balance(session, sample_user)
            assert balance_gram == Decimal("0.000")
            assert balance_minor == 0

            # 2. Credit 10.500 GRAM
            tx1, is_new1 = await execute_balance_operation(
                session,
                user_id=sample_user,
                type="deposit",
                direction="credit",
                amount_gram=Decimal("10.500"),
                client_request_id="req-dep-1",
            )
            assert is_new1 is True
            assert tx1.balance_after == Decimal("10.500")

            # 3. Debit 3.250 GRAM
            tx2, is_new2 = await execute_balance_operation(
                session,
                user_id=sample_user,
                type="game_bet",
                direction="debit",
                amount_gram=Decimal("3.250"),
                client_request_id="req-bet-1",
            )
            assert is_new2 is True
            assert tx2.balance_after == Decimal("7.250")

            # Verify balance query
            cur_gram, cur_minor = await get_user_balance(session, sample_user)
            assert cur_gram == Decimal("7.250")
            assert cur_minor == 7250
    finally:
        await engine.dispose()


async def test_ledger_rejects_insufficient_funds(sample_user: uuid.UUID) -> None:
    engine = create_async_engine(get_settings().database_url)
    try:
        async with AsyncSession(engine) as session:
            # Deposit 5 GRAM
            await execute_balance_operation(
                session,
                user_id=sample_user,
                type="deposit",
                direction="credit",
                amount_gram=Decimal("5.000"),
            )

            # Attempt to debit 6 GRAM
            with pytest.raises(InsufficientFundsError):
                await execute_balance_operation(
                    session,
                    user_id=sample_user,
                    type="game_bet",
                    direction="debit",
                    amount_gram=Decimal("6.000"),
                )

            # Balance remains exactly 5.000
            cur_gram, _ = await get_user_balance(session, sample_user)
            assert cur_gram == Decimal("5.000")
    finally:
        await engine.dispose()


async def test_ledger_idempotency_by_client_request_id(sample_user: uuid.UUID) -> None:
    engine = create_async_engine(get_settings().database_url)
    try:
        async with AsyncSession(engine) as session:
            req_id = f"idem-dep-{uuid.uuid4()}"

            # First execution
            tx1, is_new1 = await execute_balance_operation(
                session,
                user_id=sample_user,
                type="deposit",
                direction="credit",
                amount_gram=Decimal("50.000"),
                client_request_id=req_id,
            )
            assert is_new1 is True

            # Duplicate execution with same client_request_id
            tx2, is_new2 = await execute_balance_operation(
                session,
                user_id=sample_user,
                type="deposit",
                direction="credit",
                amount_gram=Decimal("50.000"),
                client_request_id=req_id,
            )
            assert is_new2 is False
            assert tx2.id == tx1.id
            assert tx2.balance_after == Decimal("50.000")

            # Balance was credited only ONCE
            cur_gram, _ = await get_user_balance(session, sample_user)
            assert cur_gram == Decimal("50.000")
    finally:
        await engine.dispose()


async def test_wallet_api_endpoints(client: AsyncClient, sample_user: uuid.UUID) -> None:
    token = create_access_token(sample_user, 999111)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Check initial balance
    resp_bal = await client.get("/api/wallet/balance", headers=headers)
    assert resp_bal.status_code == 200
    assert Decimal(resp_bal.json()["balance_gram"]) == Decimal("0.000")

    # 2. Demo deposit 100 GRAM
    resp_dep = await client.post(
        "/api/wallet/demo-deposit",
        headers=headers,
        json={"amount_gram": "100.000", "client_request_id": "demo-dep-1"},
    )
    assert resp_dep.status_code == 200
    dep_data = resp_dep.json()
    assert Decimal(dep_data["balance_after"]) == Decimal("100.000")
    assert dep_data["type"] == "demo_deposit"

    # 3. Repeat demo deposit with same request ID is idempotent
    resp_dep2 = await client.post(
        "/api/wallet/demo-deposit",
        headers=headers,
        json={"amount_gram": "100.000", "client_request_id": "demo-dep-1"},
    )
    assert resp_dep2.status_code == 200
    dep_data2 = resp_dep2.json()
    assert dep_data2["id"] == dep_data["id"]
    assert Decimal(dep_data2["balance_after"]) == Decimal("100.000")

    # 4. Fetch transactions list
    resp_tx = await client.get("/api/wallet/transactions", headers=headers)
    assert resp_tx.status_code == 200
    txs = resp_tx.json()
    assert len(txs) == 1
    assert txs[0]["client_request_id"] == "demo-dep-1"
