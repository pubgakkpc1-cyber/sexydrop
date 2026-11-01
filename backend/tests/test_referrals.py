import uuid

from httpx import AsyncClient

from app.api import referrals as referrals_api
from app.core.db import get_session_factory
from app.services import account_service
from tests.test_economy import h, login


async def test_join_qualify_and_mine(client: AsyncClient, monkeypatch):
    inviter = await login(client)
    friend = await login(client)
    current = {"id": friend["_tg"], "is_premium": True}
    monkeypatch.setattr(referrals_api, "validate_telegram_init_data", lambda raw: {"user": current})

    joined = await client.post("/api/referrals/join", json={"init_data": "x", "inviter_id": inviter["_tg"]})
    assert joined.json() == {"registered": True}
    # первый пригласивший остаётся навсегда, себя приглашать нельзя
    assert (await client.post("/api/referrals/join", json={"init_data": "x", "inviter_id": 123})).json() == {
        "registered": False
    }
    assert (await client.post("/api/referrals/join", json={"init_data": "x", "inviter_id": friend["_tg"]})).json() == {
        "registered": False
    }

    current["id"] = inviter["_tg"]
    mine = (await client.post("/api/referrals/mine", json={"init_data": "x"})).json()
    assert mine["friends"] == [{"id": str(friend["_tg"]), "premium": True, "qualified": False}]

    # друг открыл бесплатный кейс — сервер сам засчитывает, +2 ★ пригласившему один раз
    await client.post("/api/play/free/free24/claim", headers=h(friend), json={"client_request_id": "rf1"})
    mine = (await client.post("/api/referrals/mine", json={"init_data": "x"})).json()
    assert mine["friends"][0]["qualified"] is True
    assert (await client.get("/api/me/state", headers=h(inviter))).json()["stars"] == 2
    assert (await client.get("/api/me/state", headers=h(inviter))).json()["stars"] == 2


async def test_start_param_attributes_new_user(client: AsyncClient):
    inviter = await login(client)
    friend = await login(client, ref=inviter["_user"]["referral_code"])
    assert friend["_user"]["referred_by_id"] == inviter["_user"]["id"]
    self_ref = await login(client, tg_id=inviter["_tg"], ref=inviter["_user"]["referral_code"])
    assert self_ref["_user"]["referred_by_id"] is None


async def test_friend_deposit_counts_for_quest(client: AsyncClient):
    inviter = await login(client)
    friend = await login(client, ref=inviter["_user"]["referral_code"])
    fid = uuid.UUID(friend["_user"]["id"])
    async with get_session_factory()() as session:
        order = await account_service.create_deposit_order(session, fid, "ton", uuid.uuid4().hex, 0)
        await account_service.credit_deposit(session, order.id, 3_000, "ref-dep-" + uuid.uuid4().hex)
    assert (await client.get("/api/me/state", headers=h(inviter))).json()["metrics"]["friendDeposits"] == 1
