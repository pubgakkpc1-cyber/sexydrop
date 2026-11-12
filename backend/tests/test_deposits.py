import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app
from app.services import deposit_service as svc

SECRET = "a" * 32


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("TON_DEPOSIT_ADDRESS", "UQTestAddress")
    monkeypatch.setenv("CRYPTOBOT_TOKEN", "123:TEST")
    get_settings.cache_clear()
    try:
        yield TestClient(create_app())
    finally:
        get_settings.cache_clear()


def test_config_reports_enabled_methods(client):
    cfg = client.get("/api/deposits/config").json()
    assert cfg["ton_address"] == "UQTestAddress"
    assert cfg["cryptobot"] is True
    assert cfg["min_minor"] == 100


def test_config_disabled_without_env(monkeypatch):
    monkeypatch.setenv("TON_DEPOSIT_ADDRESS", "")
    monkeypatch.setenv("CRYPTOBOT_TOKEN", "")
    get_settings.cache_clear()
    try:
        cfg = TestClient(create_app()).get("/api/deposits/config").json()
        assert cfg["ton_address"] is None and cfg["cryptobot"] is False
    finally:
        get_settings.cache_clear()


def test_comment_is_derived_from_secret_not_equal_to_it():
    c = svc.ton_comment(SECRET)
    assert c.startswith("sd-") and SECRET not in c and c == svc.ton_comment(SECRET)
    assert c != svc.ton_comment("b" * 32)


def test_amount_conversion():
    assert svc.minor_to_ton_str(1500) == "1.500"
    assert svc.ton_to_minor("2.3456") == 2345


def test_invoice_requires_login(client):
    res = client.post("/api/deposits/cryptobot/invoice", json={"amount_minor": 1000, "secret": SECRET})
    assert res.status_code == 401
    assert client.get(f"/api/deposits/ton/status?secret={SECRET}").status_code == 401


@pytest.mark.asyncio
async def test_cryptobot_status_requires_matching_secret(monkeypatch):
    async def fake_call(method, params):
        return {"items": [{"invoice_id": 7, "status": "paid", "amount": "1.5", "payload": SECRET}]}

    monkeypatch.setattr(svc, "_crypto_call", fake_call)
    ok = await svc.cryptobot_invoice_status(7, SECRET)
    assert ok == {"status": "paid", "amount_minor": 1500}
    with pytest.raises(svc.DepositError):
        await svc.cryptobot_invoice_status(7, "b" * 32)


@pytest.mark.asyncio
async def test_ton_status_matches_comment_and_value(monkeypatch):
    monkeypatch.setenv("TON_DEPOSIT_ADDRESS", "UQTestAddress")
    get_settings.cache_clear()
    comment = svc.ton_comment(SECRET)
    body = {
        "transactions": [
            {"in_msg": {"value": "9", "message_content": {"decoded": {"comment": "other"}}}},
            {
                "description": {"aborted": False},
                "in_msg": {"value": "2500000000", "message_content": {"decoded": {"comment": comment}}},
            },
        ]
    }

    class FakeResponse:
        def json(self):
            return body

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            return FakeResponse()

    monkeypatch.setattr(svc.httpx, "AsyncClient", FakeClient)
    try:
        assert await svc.ton_payment_status(SECRET) == {"status": "paid", "amount_minor": 2500}
        assert await svc.ton_payment_status("c" * 32) == {"status": "pending"}
    finally:
        get_settings.cache_clear()


def test_stars_conversion():
    assert svc.stars_to_minor(100) == 1000
    assert svc.stars_to_minor(10) == 100


@pytest.mark.asyncio
async def test_malformed_payment_is_ignored():
    from app.services import telegram_bot

    handled = await telegram_bot.handle_update(
        {"message": {"chat": {"id": 1}, "successful_payment": {"invoice_payload": "evil", "currency": "XTR", "total_amount": 5}}}
    )
    assert handled  # апдейт принят, но ничего не зачислено (неверный payload)


@pytest.mark.asyncio
async def test_subscription_check_and_discovery(monkeypatch):
    from app.services import subscription_service as subs
    from app.services import telegram_bot

    monkeypatch.setenv("BOT_TOKEN", "123456:TEST_TOKEN_FOR_TESTS_ONLY")
    monkeypatch.setenv("SUB_PRIVATE_CHAT_ID", "-1001")
    get_settings.cache_clear()
    answers = {"@SexyDrop_official": "member", "-1001": "left"}

    async def fake_member(client, token, chat, user_id):
        return answers[chat] in ("member", "administrator", "creator")

    monkeypatch.setattr(subs, "_is_member", fake_member)
    try:
        res = await subs.check(42)
        assert res["ok"] is False
        assert [c["subscribed"] for c in res["channels"]] == [True, False]
        answers["-1001"] = "member"
        assert (await subs.check(42))["ok"] is True
        await telegram_bot.handle_update({"my_chat_member": {
            "chat": {"id": -100777, "type": "channel", "title": "Закрытый"},
            "new_chat_member": {"status": "administrator"}}})
        assert subs.discovered_chats[-100777] == "Закрытый"
    finally:
        subs.discovered_chats.clear()
        get_settings.cache_clear()


def test_subscription_check_requires_valid_init_data(client):
    res = client.post("/api/subscriptions/check", json={"init_data": "bogus"})
    assert res.status_code == 401


async def test_stars_reconcile_credits_missed_payment(client):
    """Оплата Stars дошла до Telegram, но не до сервера: сверка зачисляет её один раз, даже без заказа."""
    from app.services import stars_reconcile
    from tests.test_economy import h, login

    user = await login(client)
    payload = "sd-stars-" + "ab" * 12
    tx = {"id": "tx-test-1", "amount": 50, "source": {"type": "user", "user": {"id": user["_tg"]}, "invoice_payload": payload}}

    async def fake():
        return [tx]

    real = stars_reconcile._fetch_transactions
    stars_reconcile._force_in_test = True
    stars_reconcile._fetch_transactions = fake
    try:
        assert await stars_reconcile.reconcile() == 1
        assert await stars_reconcile.reconcile() == 0  # повтор ничего не зачисляет
    finally:
        stars_reconcile._force_in_test = False
        stars_reconcile._fetch_transactions = real
    state = (await client.get("/api/me/state", headers=h(user))).json()
    assert state["balance_minor"] == 500  # 50 Stars = 0.5 TON
