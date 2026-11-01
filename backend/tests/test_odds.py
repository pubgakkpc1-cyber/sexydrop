import pytest
from fastapi.testclient import TestClient

from app.api import odds as odds_api
from app.core.config import get_settings
from app.main import create_app
from app.services import odds_service as svc


@pytest.fixture(autouse=True)
def _fresh(monkeypatch, tmp_path):
    monkeypatch.setenv("ODDS_PATH", str(tmp_path / "odds.json"))
    get_settings.cache_clear()
    svc.reset_for_tests()
    yield
    get_settings.cache_clear()


def test_set_get_reset(monkeypatch):
    monkeypatch.setattr(odds_api, "validate_telegram_init_data", lambda raw: {"user": {"username": "ZapixxGarant"}})
    client = TestClient(create_app())
    assert client.get("/api/odds").json() == {}
    h = {"X-Telegram-Init-Data": "x"}
    assert client.put("/api/admin/odds/bronze", json={"weights": {"ton_500": 700, "a": 300}}, headers=h).status_code == 200
    assert client.get("/api/odds").json() == {"bronze": {"ton_500": 700, "a": 300}}
    assert client.put("/api/admin/odds/bronze", json={"weights": {"a": 0}}, headers=h).status_code == 400
    assert client.delete("/api/admin/odds/bronze", headers=h).status_code == 200
    assert client.get("/api/odds").json() == {}


def test_non_admin_forbidden(monkeypatch):
    monkeypatch.setattr(odds_api, "validate_telegram_init_data", lambda raw: {"user": {"username": "someone"}})
    client = TestClient(create_app())
    r = client.put("/api/admin/odds/bronze", json={"weights": {"a": 1}}, headers={"X-Telegram-Init-Data": "x"})
    assert r.status_code == 403
    assert client.put("/api/admin/odds/bronze", json={"weights": {"a": 1}}).status_code == 403
