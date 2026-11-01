import pytest
from fastapi.testclient import TestClient

from app.api import stats as stats_api
from app.core.config import get_settings
from app.main import create_app
from app.services import stats_service

USER = {"id": 7, "username": "zapixxgarant"}


@pytest.fixture(autouse=True)
def _fresh(monkeypatch, tmp_path):
    monkeypatch.setenv("STATS_PATH", str(tmp_path / "stats.json"))
    get_settings.cache_clear()
    stats_service.reset_for_tests()
    yield
    get_settings.cache_clear()


def test_record_and_snapshot():
    stats_service.record(USER, {"type": "game", "game": "Ракетка", "stake": 1000, "delta": -1000})
    stats_service.record(USER, {"type": "game", "game": "Ракетка", "stake": 1000, "delta": 1500})
    stats_service.record(USER, {"type": "case", "case": "bronze", "price": 2000, "prize": 500})
    stats_service.record(USER, {"type": "deposit", "method": "ton", "amount": 5000})
    snap = stats_service.snapshot()
    assert snap["users_total"] == 1 and snap["users_24h"] == 1
    assert snap["wagered"] == 4000
    assert snap["house_profit"] == 1000
    game = snap["games"][0]
    assert game["rounds"] == 2 and game["wins"] == 1 and game["delta"] == 500
    assert snap["cases"][0]["opens"] == 1
    assert snap["deposits"][0]["amount"] == 5000


def test_admin_stats_requires_admin(monkeypatch):
    monkeypatch.setattr(stats_api, "validate_telegram_init_data", lambda raw: {"user": {"id": 1, "username": "someone"}})
    client = TestClient(create_app())
    assert client.get("/api/admin/stats").status_code == 403
    assert client.get("/api/admin/stats", headers={"X-Telegram-Init-Data": "x"}).status_code == 403
    monkeypatch.setattr(stats_api, "validate_telegram_init_data", lambda raw: {"user": USER})
    res = client.get("/api/admin/stats", headers={"X-Telegram-Init-Data": "x"})
    assert res.status_code == 200 and res.json()["users_total"] == 0


def test_event_endpoint_validates_input(monkeypatch):
    monkeypatch.setattr(stats_api, "validate_telegram_init_data", lambda raw: {"user": USER})
    client = TestClient(create_app())
    ok = client.post("/api/events", json={"init_data": "x", "event": {"type": "open"}})
    assert ok.status_code == 204
    bad = client.post("/api/events", json={"init_data": "x", "event": {"type": "game", "game": "g", "stake": -5, "delta": 0}})
    assert bad.status_code == 422
    assert stats_service.snapshot()["users_total"] == 1


def test_leaderboard_ranks_by_turnover_without_exposing_ids():
    stats_service.record({"id": 1, "username": "alice"}, {"type": "game", "game": "g", "stake": 5000, "delta": 0})
    stats_service.record({"id": 2, "first_name": "Bob"}, {"type": "game", "game": "g", "stake": 9000, "delta": 0})
    stats_service.record({"id": 3, "username": "idle"}, {"type": "open"})
    board = stats_service.leaderboard(my_id=1)
    assert [r["name"] for r in board["rows"]] == ["Bob", "alice"]
    assert [r["points"] for r in board["rows"]] == [900, 500]
    assert board["rows"][1]["me"] is True and board["me"] == {"rank": 2, "points": 500}
    assert board["total"] == 2
    assert all("id" not in r for r in board["rows"])
