import time
import uuid
from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy import update

from app.api import broadcast as api
from app.core.config import get_settings
from app.core.db import get_session_factory
from app.models.user import User
from app.services import broadcast_service as svc
from tests.test_economy import login


async def test_audiences(client: AsyncClient, monkeypatch):
    monkeypatch.setenv("BOT_TOKEN", "123:abc")
    get_settings.cache_clear()
    fresh = await login(client)
    stale = await login(client)
    old = time.time() - 20 * 86400
    async with get_session_factory()() as session:
        await session.execute(
            update(User)
            .where(User.id == uuid.UUID(stale["_user"]["id"]))
            .values(
                created_at=datetime.fromtimestamp(old, timezone.utc),
                updated_at=datetime.fromtimestamp(old + 86400 * 10, timezone.utc),
            )
        )
        await session.commit()
        everyone = await svc.audience_ids(session, "all")
        assert fresh["_tg"] in everyone and stale["_tg"] in everyone
        assert stale["_tg"] in await svc.audience_ids(session, "inactive_7d")
        assert stale["_tg"] not in await svc.audience_ids(session, "active_7d")
        assert fresh["_tg"] in await svc.audience_ids(session, "new_24h")
        assert stale["_tg"] not in await svc.audience_ids(session, "new_24h")


async def test_endpoints_admin_only(client: AsyncClient, monkeypatch):
    await login(client)
    user = {"id": 1, "username": "someone"}
    monkeypatch.setattr(api, "validate_telegram_init_data", lambda raw: {"user": user})
    headers = {"X-Telegram-Init-Data": "x"}
    assert (await client.get("/api/admin/broadcast", headers=headers)).status_code == 403
    assert (await client.get("/api/admin/broadcast")).status_code == 403
    assert (await client.get("/api/admin/players", headers=headers)).status_code == 403

    user.update(username="zapixxgarant")
    info = (await client.get("/api/admin/broadcast", headers=headers)).json()
    assert {a["id"]: a["count"] for a in info["audiences"]}["all"] >= 1
    players = (await client.get("/api/admin/players", headers=headers)).json()
    assert players["total"] >= 1 and all(p["id"].isdigit() for p in players["rows"])
    card = (await client.get(f"/api/admin/players/{players['rows'][0]['id']}", headers=headers)).json()
    assert {"profile", "money", "games", "cases", "items", "history"} <= set(card)
    assert (await client.get("/api/admin/players/999999999999", headers=headers)).status_code == 404
    # сброс прибыли: без слова СБРОС — отказ, со словом — прибыль считается с этой минуты
    assert (await client.post("/api/admin/reset-profit", json={"confirm": "да"}, headers=headers)).status_code == 400
    reset = (await client.post("/api/admin/reset-profit", json={"confirm": "СБРОС"}, headers=headers)).json()
    from app.services.app_settings import get_profit_reset_at

    async with get_session_factory()() as session:
        at = await get_profit_reset_at(session)
    assert at is not None and int(at.timestamp()) == reset["profit_since"]
    monkeypatch.setenv("BOT_TOKEN", "123:abc")
    get_settings.cache_clear()
    bad = await client.post("/api/admin/broadcast", json={"text": "hi", "audience": "zzz"}, headers=headers)
    assert bad.status_code == 400


async def test_broadcast_presets_listed_and_validated(client: AsyncClient, monkeypatch):
    await login(client)
    monkeypatch.setattr(api, "validate_telegram_init_data", lambda raw: {"user": {"id": 1, "username": "zapixxgarant"}})
    headers = {"X-Telegram-Init-Data": "x"}
    info = (await client.get("/api/admin/broadcast", headers=headers)).json()
    assert any(p["id"] == "clicker" and "Кликалка" in p["text"] for p in info["presets"])
    monkeypatch.setattr(api, "get_settings", lambda: type("S", (), {"bot_token": "t"})())
    bad = await client.post("/api/admin/broadcast", json={"text": "hi", "audience": "all", "preset": "nope"}, headers=headers)
    assert bad.status_code == 400


async def test_maintenance_gate_blocks_api_but_not_health(client: AsyncClient):
    from app.services import maintenance

    try:
        await maintenance.set_on(True)
        assert (await client.get("/health")).status_code == 200
        blocked = await client.get("/api/me/inventory")
        assert blocked.status_code == 503 and blocked.json()["code"] == "maintenance"
        assert (await client.get("/api/maintenance")).json() == {"on": True, "admin": False}
    finally:
        await maintenance.set_on(False)
    assert (await client.get("/api/maintenance")).json()["on"] is False


async def test_admin_token_passes_maintenance_gate(client: AsyncClient):
    from app.services import maintenance

    admin = await login(client, username="zapixxgarant")
    other = await login(client)
    maintenance._admin_tokens.clear()
    try:
        await maintenance.set_on(True)
        ok = await client.get("/api/me/state", headers={"Authorization": admin["Authorization"]})
        assert ok.status_code != 503
        blocked = await client.get("/api/me/state", headers={"Authorization": other["Authorization"]})
        assert blocked.status_code == 503
    finally:
        await maintenance.set_on(False)
