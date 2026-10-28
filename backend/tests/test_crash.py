from __future__ import annotations

from decimal import Decimal
import time
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from starlette.testclient import TestClient

from app.core.config import get_settings
from app.core.realtime import CrashGameError, crash_manager
from app.core.security import create_access_token
from app.games.crash import crash_floor2, generate_crash_point
from app.main import app
from app.services.ledger_service import execute_balance_operation, get_user_balance
from app.services.user_service import get_or_create_telegram_user


@pytest.fixture
async def sample_user() -> uuid.UUID:
    engine = create_async_engine(get_settings().database_url)
    tg_id = int(time.time() * 1000) % 1_000_000_000 + 70_000_000
    try:
        async with AsyncSession(engine) as session:
            user = await get_or_create_telegram_user(
                session, telegram_id=tg_id, username=f"crash_user_{tg_id}"
            )
            user_id = user.id
            await execute_balance_operation(
                session,
                user_id=user_id,
                type="deposit",
                direction="credit",
                amount_gram=Decimal("100.000"),
            )
            return user_id
    finally:
        await engine.dispose()


@pytest.fixture(autouse=True)
async def _clean_manager() -> None:
    """Put the shared manager into a known betting state before each test."""
    from app.core.db import dispose_engine

    await dispose_engine()  # fresh async engine bound to this test's event loop
    crash_manager.phase = "betting"
    crash_manager.countdown_remaining = 5.0
    crash_manager.active_bets = {}
    crash_manager.multiplier = Decimal("1.00")
    yield
    crash_manager.active_bets = {}
    crash_manager.phase = "betting"
    crash_manager.countdown_remaining = 5.0
    crash_manager.multiplier = Decimal("1.00")


# -------------------------------------------------------------------------- #
# Unit: crash point generation
# -------------------------------------------------------------------------- #

def test_crash_point_minimum() -> None:
    for _ in range(300):
        point = generate_crash_point()
        assert point >= Decimal("1.00")


def test_crash_floor2_rounds_down() -> None:
    assert crash_floor2(Decimal("1.239")) == Decimal("1.23")
    assert crash_floor2(Decimal("3.999")) == Decimal("3.99")
    assert crash_floor2(Decimal("7.50")) == Decimal("7.50")
    assert crash_floor2(Decimal("100.00")) == Decimal("100.00")


# -------------------------------------------------------------------------- #
# Service: place_bet / cashout via manager
# -------------------------------------------------------------------------- #

async def test_place_bet_debits_balance(
    sample_user: uuid.UUID,
) -> None:
    res = await crash_manager.place_bet(
        user_id=sample_user,
        bet_gram=Decimal("10.000"),
        client_request_id=f"crash-{uuid.uuid4()}",
    )
    assert res["type"] == "bet_accepted"
    assert Decimal(res["new_balance_gram"]) == Decimal("90.000")
    assert sample_user in crash_manager.active_bets


async def test_cashout_credits_correct_amount(
    sample_user: uuid.UUID,
) -> None:
    await crash_manager.place_bet(
        user_id=sample_user,
        bet_gram=Decimal("10.000"),
        client_request_id=f"crash-{uuid.uuid4()}",
    )

    # Simulate flying phase with a known multiplier below crash point.
    crash_manager.phase = "flying"
    crash_manager.multiplier = Decimal("2.50")
    crash_manager.crash_point = Decimal("7.00")  # well above 2.50

    cash = await crash_manager.cashout(user_id=sample_user)
    assert cash["type"] == "cashout_done"
    assert cash["multiplier"] == "2.50"
    # win = floor(10000 * 250 / 100) = 25000 minor = 25.000 GRAM; bal: 90 + 25 = 115
    assert Decimal(cash["new_balance_gram"]) == Decimal("115.000")
    bet = crash_manager.active_bets[sample_user]
    assert bet["cashed_out"] is True


async def test_double_cashout_rejected(
    sample_user: uuid.UUID,
) -> None:
    await crash_manager.place_bet(
        user_id=sample_user, bet_gram=Decimal("5.000"),
        client_request_id=f"crash-{uuid.uuid4()}",
    )
    crash_manager.phase = "flying"
    crash_manager.multiplier = Decimal("2.00")
    crash_manager.crash_point = Decimal("5.00")
    await crash_manager.cashout(user_id=sample_user)

    with pytest.raises(CrashGameError, match="already cashed"):
        await crash_manager.cashout(user_id=sample_user)


async def test_bet_rejected_outside_betting_phase(
    sample_user: uuid.UUID,
) -> None:
    crash_manager.phase = "flying"
    with pytest.raises(CrashGameError, match="not accepting"):
        await crash_manager.place_bet(user_id=sample_user, bet_gram=Decimal("1.000"))


async def test_second_bet_in_same_round_rejected(
    sample_user: uuid.UUID,
) -> None:
    await crash_manager.place_bet(
        user_id=sample_user, bet_gram=Decimal("1.000"),
        client_request_id=f"crash-{uuid.uuid4()}",
    )
    with pytest.raises(CrashGameError, match="already have a bet"):
        await crash_manager.place_bet(
            user_id=sample_user, bet_gram=Decimal("1.000"),
            client_request_id=f"crash-{uuid.uuid4()}",
        )


async def test_service_bet_idempotent_by_request_id(
    sample_user: uuid.UUID,
) -> None:
    from app.core.db import get_session_factory
    from app.services.crash_service import place_crash_bet

    req_id = f"crash-{uuid.uuid4()}"
    factory = get_session_factory()
    async with factory() as session:
        r1, bal1 = await place_crash_bet(
            session,
            user_id=sample_user,
            bet_gram=Decimal("1.000"),
            server_round_id="sr-idem",
            client_request_id=req_id,
        )
        r2, bal2 = await place_crash_bet(
            session,
            user_id=sample_user,
            bet_gram=Decimal("1.000"),
            server_round_id="sr-idem",
            client_request_id=req_id,
        )
        assert r1.id == r2.id
        assert bal1 == bal2
        # No second debit: first debit was 1.000; balance stays 99.000
        assert bal1 == Decimal("99.000")


# -------------------------------------------------------------------------- #
# Manager step() -> crash round
# -------------------------------------------------------------------------- #

async def test_step_betting_to_flying(
    sample_user: uuid.UUID,
) -> None:
    await crash_manager.place_bet(
        user_id=sample_user, bet_gram=Decimal("1.000"),
        client_request_id=f"crash-{uuid.uuid4()}",
    )
    crash_manager.phase = "betting"
    crash_manager.countdown_remaining = 0.0
    await crash_manager.step()
    assert crash_manager.phase == "flying"
    assert crash_manager.multiplier == Decimal("1.00")


async def test_step_flying_then_crash_marks_bet_lost(
    sample_user: uuid.UUID,
) -> None:
    await crash_manager.place_bet(
        user_id=sample_user, bet_gram=Decimal("5.000"),
        client_request_id=f"crash-{uuid.uuid4()}",
    )
    crash_manager.phase = "flying"
    crash_manager.multiplier = Decimal("1.00")
    crash_manager.crash_point = Decimal("1.05")  # 1.00 * 1.09 = 1.09 >= 1.05
    crash_manager.flying_elapsed_ms = 0

    # First step: multiplier grows from 1.00 to 1.09, still below 1.05? Actually
    # 1.09 >= 1.05 → crash
    await crash_manager.step()
    assert crash_manager.phase == "crashed"
    assert sample_user in crash_manager.active_bets
    # Bet was NOT cashed out — it's lost; balance stays at 95.000
    assert crash_manager.active_bets[sample_user].get("cashed_out", False) is False

    # Finalise: balance should remain 95.000 (no credit for lost bet)
    bal, _ = await get_user_balance_safe(sample_user)
    assert bal == Decimal("95.000")


# -------------------------------------------------------------------------- #
# WebSocket flow (auth → bet → double-bet rejection)
# -------------------------------------------------------------------------- #

async def test_ws_auth_bet_double_bet_rejection(
    sample_user: uuid.UUID,
) -> None:
    token = create_access_token(sample_user, 999999)
    crash_manager.phase = "betting"

    with TestClient(app).websocket_connect("/api/ws/crash") as ws:
        # Initial state on connect
        state = ws.receive_json()
        assert state["type"] == "state"
        assert state["phase"] == "betting"

        # Auth
        ws.send_json({"action": "auth", "token": token})
        auth = ws.receive_json()
        assert auth["type"] == "auth_ok"

        # Place bet
        ws.send_json(
            {
                "action": "bet",
                "bet_gram": "2.000",
                "client_request_id": f"ws-crash-{uuid.uuid4()}",
            }
        )
        bet_resp = ws.receive_json()
        assert bet_resp["type"] == "bet_accepted"
        assert Decimal(bet_resp["new_balance_gram"]) == Decimal("98.000")

        # Second bet in same round → WS error
        ws.send_json({"action": "bet", "bet_gram": "1.000"})
        err = ws.receive_json()
        assert err["type"] == "bet_error"
        assert "already have a bet" in err["error"]

        # Auth required for cashout (no auth token first)
        with TestClient(app).websocket_connect("/api/ws/crash") as ws2:
            _initial_state = ws2.receive_json()
            ws2.send_json({"action": "cashout"})
            err2 = ws2.receive_json()
            assert err2["error"] == "auth_required"


# -------------------------------------------------------------------------- #
# Helpers
# -------------------------------------------------------------------------- #

async def get_user_balance_safe(user_id: uuid.UUID) -> tuple[Decimal, int]:
    engine = create_async_engine(get_settings().database_url)
    try:
        async with AsyncSession(engine) as session:
            bal, minor = await get_user_balance(session, user_id)
            return bal, minor
    finally:
        await engine.dispose()
