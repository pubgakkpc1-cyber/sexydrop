import time

import pytest
from fastapi.testclient import TestClient

from app.api import broadcast as api
from app.core.config import get_settings
from app.main import create_app
from app.services import broadcast_service as svc
from app.services import stats_service


@pytest.fixture(autouse=True)
def _fresh(monkeypatch, tmp_path):
    monkeypatch.setenv("STATS_PATH", str(tmp_path / "stats.json"))
    monkeypatch.setenv("BOT_TOKEN", "123:abc")
    get_settings.cache_clear()
    stats_service.reset_for_tests()
    yield
    get_settings.cache_clear()


def _seed():
    stats_service.record({"id": 10, "username": "a"}, {"type": "open"})
    stats_service.record({"id": 11, "username": "b"}, {"type": "open"})
    with stats_service._lock:  # noqa: SLF001
        stats_service._load()["users"]["11"]["last"] = int(time.time()) - 10 * 86400  # noqa: SLF001
        stats_service._load()["users"]["11"]["first"] = int(time.time()) - 20 * 86400  # noqa: SLF001


def test_audiences():
    _seed()
    assert sorted(svc.audience_ids("all")) == [10, 11]
    assert svc.audience_ids("active_7d") == [10]
    assert svc.audience_ids("inactive_7d") == [11]
    assert svc.audience_ids("new_24h") == [10]


def test_endpoints_admin_only(monkeypatch):
    _seed()
    user = {"id": 1, "username": "someone"}
    monkeypatch.setattr(api, "validate_telegram_init_data", lambda raw: {"user": user})
    client = TestClient(create_app())
    h = {"X-Telegram-Init-Data": "x"}
    assert client.get("/api/admin/broadcast", headers=h).status_code == 403
    assert client.get("/api/admin/broadcast").status_code == 403
    assert client.get("/api/admin/players", headers=h).status_code == 403

    user.update(username="zapixxgarant")
    info = client.get("/api/admin/broadcast", headers=h).json()
    assert {a["id"]: a["count"] for a in info["audiences"]}["all"] == 2
    players = client.get("/api/admin/players", headers=h).json()
    assert [p["id"] for p in players] == ["10", "11"]
    bad = client.post("/api/admin/broadcast", json={"text": "hi", "audience": "zzz"}, headers=h)
    assert bad.status_code == 400
