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


def test_invoice_amount_bounds(client):
    res = client.post("/api/deposits/cryptobot/invoice", json={"amount_minor": 5, "secret": SECRET})
    assert res.status_code == 400
    res = client.post("/api/deposits/cryptobot/invoice", json={"amount_minor": 1000, "secret": "short"})
    assert res.status_code == 422


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


def test_stars_conversion_and_status():
    assert svc.stars_to_minor(175) == 1000
    assert svc.stars_to_minor(10) == 57
    svc.paid_stars.clear()
    assert svc.stars_status(SECRET) == {"status": "pending"}
    svc.paid_stars[svc.stars_payload(SECRET)] = 350
    assert svc.stars_status(SECRET) == {"status": "paid", "amount_minor": 2000}
    assert svc.stars_status("d" * 32) == {"status": "pending"}


@pytest.mark.asyncio
async def test_successful_payment_is_recorded_and_precheckout_validated(monkeypatch):
    from app.services import telegram_bot

    svc.paid_stars.clear()
    payload = svc.stars_payload(SECRET)
    handled = await telegram_bot.handle_update(
        {"message": {"chat": {"id": 1, "type": "private"},
                     "successful_payment": {"invoice_payload": payload, "currency": "XTR", "total_amount": 100}}}
    )
    assert handled and svc.paid_stars[payload] == 100
    # чужой payload не записывается
    await telegram_bot.handle_update(
        {"message": {"chat": {"id": 1}, "successful_payment": {"invoice_payload": "evil", "currency": "XTR", "total_amount": 5}}}
    )
    assert "evil" not in svc.paid_stars
