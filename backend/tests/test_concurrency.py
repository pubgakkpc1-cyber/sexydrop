from __future__ import annotations

import asyncio
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
async def concurrency_user() -> uuid.UUID:
    engine = create_async_engine(get_settings().database_url)
    tg_id = int(time.time() * 1000) % 1_000_000_000 + 70_000_000
    try:
        async with AsyncSession(engine) as session:
            user = await get_or_create_telegram_user(
                session, telegram_id=tg_id, username=f"conc_user_{tg_id}"
            )
            return user.id
    finally:
        await engine.dispose()


async def test_concurrent_debits_prevent_overdraft(concurrency_user: uuid.UUID) -> None:
    """Verify that multiple concurrent debit requests cannot overdraft the account.

    User has 10.000 GRAM. We fire 10 concurrent debits of 2.500 GRAM.
    Exactly 4 must succeed, 6 must fail with InsufficientFundsError,
    and final balance must be exactly 0.000 GRAM.
    """
    engine = create_async_engine(get_settings().database_url, pool_size=15, max_overflow=5)
    try:
        # Deposit 10.000 GRAM
        async with AsyncSession(engine) as session:
            await execute_balance_operation(
                session,
                user_id=concurrency_user,
                type="deposit",
                direction="credit",
                amount_gram=Decimal("10.000"),
            )

        async def worker(idx: int):
            async with AsyncSession(engine) as session:
                return await execute_balance_operation(
                    session,
                    user_id=concurrency_user,
                    type="game_bet",
                    direction="debit",
                    amount_gram=Decimal("2.500"),
                    client_request_id=f"conc-debit-{idx}-{uuid.uuid4()}",
                )

        results = await asyncio.gather(*[worker(i) for i in range(10)], return_exceptions=True)

        successes = [r for r in results if not isinstance(r, Exception)]
        failures = [r for r in results if isinstance(r, InsufficientFundsError)]

        assert len(successes) == 4
        assert len(failures) == 6

        async with AsyncSession(engine) as session:
            final_gram, final_minor = await get_user_balance(session, concurrency_user)
            assert final_gram == Decimal("0.000")
            assert final_minor == 0
    finally:
        await engine.dispose()


async def test_concurrent_idempotent_requests(concurrency_user: uuid.UUID) -> None:
    """Verify that firing multiple concurrent requests with the SAME client_request_id executes only once."""
    engine = create_async_engine(get_settings().database_url, pool_size=15, max_overflow=5)
    try:
        # Deposit 50.000 GRAM
        async with AsyncSession(engine) as session:
            await execute_balance_operation(
                session,
                user_id=concurrency_user,
                type="deposit",
                direction="credit",
                amount_gram=Decimal("50.000"),
            )

        shared_req_id = f"shared-req-{uuid.uuid4()}"

        async def worker():
            async with AsyncSession(engine) as session:
                return await execute_balance_operation(
                    session,
                    user_id=concurrency_user,
                    type="game_bet",
                    direction="debit",
                    amount_gram=Decimal("10.000"),
                    client_request_id=shared_req_id,
                )

        results = await asyncio.gather(*[worker() for _ in range(8)], return_exceptions=True)

        for r in results:
            assert not isinstance(r, Exception)
            tx, is_new = r
            assert tx.client_request_id == shared_req_id
            assert tx.amount == Decimal("10.000")
            assert tx.balance_after == Decimal("40.000")

        # Balance was reduced only once from 50 to 40
        async with AsyncSession(engine) as session:
            cur_bal, _ = await get_user_balance(session, concurrency_user)
            assert cur_bal == Decimal("40.000")
    finally:
        await engine.dispose()


async def test_concurrent_credits_no_lost_updates(concurrency_user: uuid.UUID) -> None:
    """Verify that multiple concurrent credits do not suffer from lost updates."""
    engine = create_async_engine(get_settings().database_url, pool_size=20, max_overflow=5)
    try:
        async def credit_worker(idx: int):
            async with AsyncSession(engine) as session:
                return await execute_balance_operation(
                    session,
                    user_id=concurrency_user,
                    type="deposit",
                    direction="credit",
                    amount_gram=Decimal("1.250"),
                    client_request_id=f"credit-{idx}-{uuid.uuid4()}",
                )

        results = await asyncio.gather(*[credit_worker(i) for i in range(16)], return_exceptions=True)
        for r in results:
            assert not isinstance(r, Exception)

        # 16 * 1.250 = 20.000 GRAM
        async with AsyncSession(engine) as session:
            cur_bal, _ = await get_user_balance(session, concurrency_user)
            assert cur_bal == Decimal("20.000")
    finally:
        await engine.dispose()


async def test_concurrent_dice_bets_no_overdraft_api(
    client: AsyncClient,
    concurrency_user: uuid.UUID,
) -> None:
    """Test concurrent API requests to /api/games/dice/play prevent overdraft."""
    engine = create_async_engine(get_settings().database_url)
    try:
        async with AsyncSession(engine) as session:
            # Fund user with exactly 5.000 GRAM
            await execute_balance_operation(
                session,
                user_id=concurrency_user,
                type="deposit",
                direction="credit",
                amount_gram=Decimal("5.000"),
            )
    finally:
        await engine.dispose()

    token = create_access_token(concurrency_user, 999999)
    headers = {"Authorization": f"Bearer {token}"}

    async def play_worker(idx: int):
        return await client.post(
            "/api/games/dice/play",
            headers=headers,
            json={
                "bet_gram": "1.000",
                "target": 5000,
                "direction": "over",
                "client_request_id": f"api-dice-{idx}-{uuid.uuid4()}",
            },
        )

    responses = await asyncio.gather(*[play_worker(i) for i in range(10)])

    status_200 = [r for r in responses if r.status_code == 200]
    status_402 = [r for r in responses if r.status_code == 402]

    # At least 5 bets had enough balance to place (wins could have credited back, but no overdraft can happen)
    assert len(status_200) >= 5
    for r in status_402:
        assert "Insufficient funds" in r.json()["detail"]
