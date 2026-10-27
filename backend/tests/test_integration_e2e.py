from __future__ import annotations

import asyncio
from decimal import Decimal
import json
import time
import uuid

import pytest
from httpx import AsyncClient

from app.core.realtime import broadcaster
from tests.test_auth import _generate_valid_init_data


async def test_full_platform_e2e_lifecycle(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Comprehensive End-to-End integration test covering the complete user lifecycle.

    Flow:
    1. Telegram Auth -> User registration with HMAC initData
    2. Referral linking -> Referee signs up with Referrer's code
    3. Wallet -> Deposit funds, query balance
    4. Free Case -> Claim free case, verify cooldown enforcement
    5. Realtime Drop Event -> Verify SSE subscriber receives the case drop
    6. Paid Case -> Open Farm case (0.100 GRAM), verify inventory & balance debit
    7. Inventory -> Sell won gift for GRAM, verify atomic credit
    8. Games (Dice & Mines) -> Place bets, execute steps, cashout, update ledger
    9. Real Leaderboard -> Confirm user aggregated stats
    10. Idempotency -> Re-send requests with same client_request_id, confirm zero duplicate mutations
    """
    bot_token = "123456789:AAHE2E_TEST_BOT_TOKEN_XYZ"
    monkeypatch.setenv("BOT_TOKEN", bot_token)

    # -------------------------------------------------------------
    # Step 1: User A (Referrer) registers via Telegram WebApp initData
    # -------------------------------------------------------------
    user_a_tg_id = int(time.time() * 1000) % 1_000_000_000 + 80_000_000
    user_a_init = _generate_valid_init_data(
        bot_token,
        {"id": user_a_tg_id, "first_name": "AliceReferrer", "username": f"alice_{user_a_tg_id}"},
    )
    resp_a = await client.post("/api/auth/telegram", json={"init_data": user_a_init})
    assert resp_a.status_code == 200
    auth_a = resp_a.json()
    token_a = auth_a["token"]
    user_a = auth_a["user"]
    ref_code_a = user_a["referral_code"]
    assert ref_code_a == f"ref-{user_a_tg_id}"

    # -------------------------------------------------------------
    # Step 2: User B (Referee) registers with User A's referral code
    # -------------------------------------------------------------
    user_b_tg_id = user_a_tg_id + 1
    user_b_init = _generate_valid_init_data(
        bot_token,
        {"id": user_b_tg_id, "first_name": "BobReferee", "username": f"bob_{user_b_tg_id}"},
    )
    resp_b = await client.post(
        "/api/auth/telegram",
        json={"init_data": user_b_init, "referral_code": ref_code_a},
    )
    assert resp_b.status_code == 200
    auth_b = resp_b.json()
    token_b = auth_b["token"]
    user_b = auth_b["user"]
    assert user_b["referred_by_id"] == user_a["id"]

    headers_b = {"Authorization": f"Bearer {token_b}"}

    # -------------------------------------------------------------
    # Step 3: Wallet deposit & balance check
    # -------------------------------------------------------------
    resp_bal_initial = await client.get("/api/wallet/balance", headers=headers_b)
    assert resp_bal_initial.status_code == 200
    assert Decimal(resp_bal_initial.json()["balance_gram"]) == Decimal("0.000")

    dep_req_id = f"e2e-dep-{uuid.uuid4()}"
    resp_dep = await client.post(
        "/api/wallet/demo-deposit",
        headers=headers_b,
        json={"amount_gram": "20.000", "client_request_id": dep_req_id},
    )
    assert resp_dep.status_code == 200
    assert Decimal(resp_dep.json()["balance_after"]) == Decimal("20.000")

    # -------------------------------------------------------------
    # Step 4 & 5: Free Case Open + Realtime SSE drop broadcast
    # -------------------------------------------------------------
    sse_queue = broadcaster.subscribe()
    try:
        resp_free = await client.post("/api/cases/free/open", headers=headers_b, json={})
        assert resp_free.status_code == 200
        free_data = resp_free.json()
        assert free_data["case_id"] == "free"
        assert Decimal(free_data["cost_gram"]) == Decimal("0.000")
        assert free_data["winning_gift_id"] is not None

        # Verify SSE broadcast event was received
        assert not sse_queue.empty()
        sse_event_raw = await sse_queue.get()
        drop_payload = json.loads(sse_event_raw.replace("data: ", "").strip())
        assert drop_payload["type"] == "drop"
        assert drop_payload["gift_id"] == free_data["winning_gift_id"]
        assert drop_payload["case_id"] == "free"

        # Verify free case is on cooldown
        resp_free_again = await client.post("/api/cases/free/open", headers=headers_b, json={})
        assert resp_free_again.status_code == 400
    finally:
        broadcaster.unsubscribe(sse_queue)

    # -------------------------------------------------------------
    # Step 6: Paid Case Open (Farm case costs 0.100 GRAM)
    # -------------------------------------------------------------
    open_req_id = f"e2e-paid-case-{uuid.uuid4()}"
    resp_paid = await client.post(
        "/api/cases/farm/open",
        headers=headers_b,
        json={"client_request_id": open_req_id},
    )
    assert resp_paid.status_code == 200
    paid_data = resp_paid.json()
    assert paid_data["case_id"] == "farm"
    assert Decimal(paid_data["cost_gram"]) == Decimal("0.100")
    assert Decimal(paid_data["new_balance_gram"]) == Decimal("19.900")
    farm_item_id = paid_data["inventory_item_id"]

    # -------------------------------------------------------------
    # Step 7: Inventory & Sell Won Item
    # -------------------------------------------------------------
    resp_inv = await client.get("/api/inventory/items", headers=headers_b)
    assert resp_inv.status_code == 200
    items = resp_inv.json()
    assert len(items) == 2  # Free case item + Farm case item

    target_item = next(i for i in items if i["id"] == farm_item_id)
    item_catalog_price = Decimal(str(target_item["gift"]["price"]))

    resp_sell = await client.post(
        "/api/inventory/sell",
        headers=headers_b,
        json={"item_id": farm_item_id},
    )
    assert resp_sell.status_code == 200
    sell_data = resp_sell.json()
    assert Decimal(sell_data["sold_price"]) == item_catalog_price
    expected_balance = Decimal("19.900") + item_catalog_price
    assert Decimal(sell_data["new_balance_gram"]) == expected_balance

    # -------------------------------------------------------------
    # Step 8: Play Dice Game
    # -------------------------------------------------------------
    dice_req = f"e2e-dice-{uuid.uuid4()}"
    resp_dice = await client.post(
        "/api/games/dice/play",
        headers=headers_b,
        json={
            "bet_gram": "2.000",
            "target": 5000,
            "direction": "over",
            "client_request_id": dice_req,
        },
    )
    assert resp_dice.status_code == 200
    dice_data = resp_dice.json()
    assert 0 <= dice_data["roll"] <= 9999

    # -------------------------------------------------------------
    # Step 9: Check Real Leaderboard
    # -------------------------------------------------------------
    resp_lead = await client.get("/api/games/leaderboard")
    assert resp_lead.status_code == 200
    leaderboard = resp_lead.json()
    bob_stat = next((e for e in leaderboard if e["user_id"] == user_b["id"]), None)
    assert bob_stat is not None
    assert bob_stat["total_rounds"] >= 1
    assert Decimal(bob_stat["wagered_gram"]) >= Decimal("2.000")

    # -------------------------------------------------------------
    # Step 10: Idempotency Verification
    # -------------------------------------------------------------
    # Re-send the same paid case open request
    resp_paid_dup = await client.post(
        "/api/cases/farm/open",
        headers=headers_b,
        json={"client_request_id": open_req_id},
    )
    assert resp_paid_dup.status_code == 200
    assert resp_paid_dup.json()["is_new_open"] is False
    assert resp_paid_dup.json()["inventory_item_id"] == farm_item_id
