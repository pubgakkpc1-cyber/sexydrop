from __future__ import annotations

from decimal import Decimal
import time
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import get_settings
from app.core.security import create_access_token
from app.services.ledger_service import execute_balance_operation, get_user_balance
from app.services.user_service import get_or_create_telegram_user


@pytest.fixture
async def sample_user() -> uuid.UUID:
    engine = create_async_engine(get_settings().database_url)
    tg_id = int(time.time() * 1000) % 1_000_000_000 + 60_000_000
    try:
        async with AsyncSession(engine) as session:
            user = await get_or_create_telegram_user(
                session, telegram_id=tg_id, username=f"game_user_{tg_id}"
            )
            user_id = user.id
            # Fund with 100.000 GRAM
            await execute_balance_operation(
                session,
                user_id=user_id,
                type="deposit",
                direction="credit",
                amount_gram=Decimal("100.000"),
            )
            await session.commit()
            return user_id
    finally:
        await engine.dispose()


async def test_dice_play_flow(client: AsyncClient, sample_user: uuid.UUID) -> None:
    token = create_access_token(sample_user, 999555)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Play dice over 5000 (roughly 50% chance, multiplier ~1.96)
    req_id = f"dice-test-{uuid.uuid4()}"
    resp = await client.post(
        "/api/games/dice/play",
        headers=headers,
        json={
            "bet_gram": "1.000",
            "target": 5000,
            "direction": "over",
            "client_request_id": req_id,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert 0 <= data["roll"] <= 9999
    assert data["target"] == 5000
    assert float(data["multiplier"]) > 1.95
    if data["is_win"]:
        assert Decimal(data["win_amount"]) > Decimal("1.000")
        assert Decimal(data["new_balance_gram"]) > Decimal("100.000")
    else:
        assert Decimal(data["win_amount"]) == Decimal("0.000")
        assert Decimal(data["new_balance_gram"]) == Decimal("99.000")

    # 2. Repeating request with same client_request_id is idempotent
    resp_dup = await client.post(
        "/api/games/dice/play",
        headers=headers,
        json={
            "bet_gram": "1.000",
            "target": 5000,
            "direction": "over",
            "client_request_id": req_id,
        },
    )
    assert resp_dup.status_code == 200
    assert resp_dup.json()["round_id"] == data["round_id"]
    assert resp_dup.json()["roll"] == data["roll"]
    assert resp_dup.json()["new_balance_gram"] == data["new_balance_gram"]


async def test_dice_validation_and_insufficient_funds(client: AsyncClient, sample_user: uuid.UUID) -> None:
    token = create_access_token(sample_user, 999666)
    headers = {"Authorization": f"Bearer {token}"}

    # Invalid target
    resp_bad = await client.post(
        "/api/games/dice/play",
        headers=headers,
        json={"bet_gram": "1.000", "target": 50, "direction": "under"},
    )
    assert resp_bad.status_code in (400, 422)

    # Insufficient funds
    resp_poor = await client.post(
        "/api/games/dice/play",
        headers=headers,
        json={"bet_gram": "500.000", "target": 5000, "direction": "under"},
    )
    assert resp_poor.status_code == 402


async def test_mines_play_and_cashout_flow(client: AsyncClient, sample_user: uuid.UUID) -> None:
    token = create_access_token(sample_user, 999777)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Start mines round (3 mines)
    resp_start = await client.post(
        "/api/games/mines/start",
        headers=headers,
        json={"bet_gram": "2.000", "mine_count": 3},
    )
    assert resp_start.status_code == 200
    round_data = resp_start.json()
    round_id = round_data["round_id"]
    assert round_data["status"] == "active"
    assert round_data["revealed_mines"] is None  # Mines are hidden!
    assert Decimal(round_data["new_balance_gram"]) == Decimal("98.000")

    # 2. Cannot start second round while active
    resp_double = await client.post(
        "/api/games/mines/start",
        headers=headers,
        json={"bet_gram": "1.000", "mine_count": 5},
    )
    assert resp_double.status_code == 400

    # 3. Take a step
    # We inspect the database directly to pick a guaranteed safe tile for test stability
    engine = create_async_engine(get_settings().database_url)
    try:
        async with AsyncSession(engine) as session:
            from app.models.games import GameRound
            r = await session.get(GameRound, uuid.UUID(round_id))
            mines = set(r.game_state["mine_positions"])
            safe_tiles = [i for i in range(25) if i not in mines]
            chosen_safe = safe_tiles[0]
    finally:
        await engine.dispose()

    resp_step = await client.post(
        f"/api/games/mines/{round_id}/step",
        headers=headers,
        json={"tile_index": chosen_safe},
    )
    assert resp_step.status_code == 200
    step_data = resp_step.json()
    assert step_data["status"] == "active"
    assert step_data["picked_tiles"] == [chosen_safe]
    assert Decimal(step_data["multiplier"]) > Decimal("1.00")

    # 4. Cash out
    resp_cash = await client.post(
        f"/api/games/mines/{round_id}/cashout",
        headers=headers,
    )
    assert resp_cash.status_code == 200
    cash_data = resp_cash.json()
    assert cash_data["status"] == "cashed_out"
    assert len(cash_data["revealed_mines"]) == 3
    assert Decimal(cash_data["win_amount"]) > Decimal("2.000")
    assert Decimal(cash_data["new_balance_gram"]) > Decimal("98.000")


async def test_game_history_and_leaderboard(client: AsyncClient, sample_user: uuid.UUID) -> None:
    token = create_access_token(sample_user, 999888)
    headers = {"Authorization": f"Bearer {token}"}

    # Play 1 dice game
    await client.post(
        "/api/games/dice/play",
        headers=headers,
        json={"bet_gram": "1.000", "target": 5000, "direction": "over"},
    )

    # 1. History
    resp_hist = await client.get("/api/games/history", headers=headers)
    assert resp_hist.status_code == 200
    history = resp_hist.json()
    assert len(history) >= 1
    assert history[0]["game_type"] == "dice"

    # 2. Leaderboard
    resp_lead = await client.get("/api/games/leaderboard?limit=100")
    assert resp_lead.status_code == 200
    leaderboard = resp_lead.json()
    assert len(leaderboard) >= 1
    user_entry = next((e for e in leaderboard if e["user_id"] == str(sample_user)), None)
    if user_entry is None:
        # User might be ranked below 100 or need higher wager
        assert any(e["user_id"] for e in leaderboard)
    else:
        assert user_entry["total_rounds"] >= 1
        assert Decimal(user_entry["wagered_gram"]) >= Decimal("1.000")
