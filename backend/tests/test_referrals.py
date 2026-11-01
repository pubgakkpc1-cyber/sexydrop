import pytest
from fastapi.testclient import TestClient

from app.api import referrals as referrals_api
from app.core.config import get_settings
from app.main import create_app
from app.services import referral_service as svc


@pytest.fixture(autouse=True)
def _fresh(monkeypatch, tmp_path):
    monkeypatch.setenv("REFERRALS_PATH", str(tmp_path / "ref.json"))
    get_settings.cache_clear()
    svc.reset_for_tests()
    yield
    get_settings.cache_clear()


def test_join_qualify_and_mine():
    assert svc.join({"id": 2, "is_premium": True}, 1) is True
    assert svc.join({"id": 3}, 1) is True
    assert svc.join({"id": 2}, 9) is False  # первый пригласивший остаётся
    assert svc.join({"id": 1}, 1) is False  # себя приглашать нельзя
    assert svc.qualify({"id": 2, "is_premium": True}) is True
    assert svc.qualify({"id": 99}) is False  # не пришёл по ссылке
    friends = {f["id"]: f for f in svc.friends_of(1)}
    assert friends["2"] == {"id": "2", "premium": True, "qualified": True}
    assert friends["3"]["qualified"] is False and friends["3"]["premium"] is False
    assert svc.friends_of(9) == []


def test_endpoints(monkeypatch):
    current = {"id": 2, "is_premium": True}
    monkeypatch.setattr(referrals_api, "validate_telegram_init_data", lambda raw: {"user": current})
    client = TestClient(create_app())
    assert client.post("/api/referrals/join", json={"init_data": "x", "inviter_id": 1}).json() == {"registered": True}
    assert client.post("/api/referrals/qualify", json={"init_data": "x"}).json() == {"qualified": True}
    current = {"id": 1}
    monkeypatch.setattr(referrals_api, "validate_telegram_init_data", lambda raw: {"user": current})
    mine = client.post("/api/referrals/mine", json={"init_data": "x"}).json()
    assert mine["friends"] == [{"id": "2", "premium": True, "qualified": True}]
