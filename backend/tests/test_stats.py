from httpx import AsyncClient

from app.api import stats as stats_api
from app.core.db import get_session_factory
from app.services import stats_service
from tests.test_economy import admin, give, h, login, player  # noqa: F401  (фикстуры и хелперы)

USER = {"id": 7, "username": "zapixxgarant"}


async def test_admin_stats_requires_admin(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(stats_api, "validate_telegram_init_data", lambda raw: {"user": {"id": 1, "username": "someone"}})
    assert (await client.get("/api/admin/stats")).status_code == 403
    assert (await client.get("/api/admin/stats", headers={"X-Telegram-Init-Data": "x"})).status_code == 403
    monkeypatch.setattr(stats_api, "validate_telegram_init_data", lambda raw: {"user": USER})
    res = await client.get("/api/admin/stats", headers={"X-Telegram-Init-Data": "x"})
    assert res.status_code == 200 and "users_total" in res.json()


async def test_legacy_event_endpoint_is_accepted_and_ignored(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(stats_api, "validate_telegram_init_data", lambda raw: {"user": USER})
    ok = await client.post("/api/events", json={"init_data": "x", "event": {"type": "open"}})
    assert ok.status_code == 204
    bad = await client.post(
        "/api/events", json={"init_data": "x", "event": {"type": "game", "game": "g", "stake": -5, "delta": 0}}
    )
    assert bad.status_code == 422


async def _snapshot() -> dict:
    async with get_session_factory()() as session:
        return await stats_service.snapshot(session)


async def test_snapshot_is_built_from_server_records(client: AsyncClient, admin, player):  # noqa: F811
    await give(client, admin, player, "10")
    before = await _snapshot()
    await client.post("/api/play/cases/farm/open", headers=h(player), json={"client_request_id": "st1"})
    after = await _snapshot()
    assert after["wagered"] - before["wagered"] >= 6500
    farm = next(c for c in after["cases"] if c["case"] == "farm")
    assert farm["opens"] >= 1 and farm["spent"] >= 6500
    assert after["users_total"] >= 2
    player_net = sum(g["delta"] for g in after["games"]) + sum(c["prize"] - c["spent"] for c in after["cases"])
    assert after["house_profit"] == -player_net
