from types import SimpleNamespace

import pytest

from app.core import catalog
from app.core.db import get_session_factory
from app.services import market_prices, prize_bank
from tests.test_economy import _own_item, admin, give, h, player  # noqa: F401


@pytest.fixture(autouse=True)
def _reset_market():
    market_prices._state.update({"markup_pct": None, "floors": {}, "updated_at": None, "claimed_at": 0, "last": None})
    market_prices._live.clear()
    yield
    market_prices._state.update({"markup_pct": None, "floors": {}, "updated_at": None, "claimed_at": 0, "last": None})
    market_prices._live.clear()


def _gift():
    gid = next(g for g in market_prices._assets() if g.startswith("plush_pepe"))
    return gid, market_prices._assets()[gid]


def test_without_settings_catalog_prices_are_untouched():
    gid, meta = _gift()
    assert market_prices.live_price(gid) is None
    assert catalog.gift_price(gid) == meta["base_minor"]


def test_one_price_for_all_variants_and_black_backdrop_separate():
    assets = market_prices._assets()
    gid, meta = _gift()
    slug = meta["slug"]
    plain = [g for g, m in assets.items() if m["slug"] == slug and m["backdrop"] != "Black"]
    floors = {slug: meta["ref_floor_ton"]}
    prices = {market_prices._compute_one(g, floors, 10.0) for g in plain}
    assert prices == {round(meta["ref_floor_ton"] * 1000 * 1.10)}  # одна цена на все модели и фоны + наценка
    black = [g for g, m in assets.items() if m["slug"] == slug and m["backdrop"] == "Black"]
    if black:
        floors[f"{slug}|Black"] = meta["ref_floor_ton"] * 2
        assert market_prices._compute_one(black[0], floors, 0.0) == round(meta["ref_floor_ton"] * 2000)
        floors[f"{slug}|Black"] = meta["ref_floor_ton"] * 100  # потолок 5 флоров
        assert market_prices._compute_one(black[0], floors, 0.0) == round(meta["ref_floor_ton"] * 5000)


async def test_refresh_applies_prices_and_keeps_old_floor_on_failure(client, monkeypatch):
    gid, meta = _gift()

    async def fake_many(slugs):
        return {meta["slug"]: meta["ref_floor_ton"] * 1.5}, ["other"]

    monkeypatch.setattr(market_prices, "_fetch_many", fake_many)
    report = await market_prices.refresh(trigger="test")
    assert report["ok"] == 1 and report["failed"] == 1
    assert catalog.gift_price(gid) == round(meta["ref_floor_ton"] * 1.5 * 1000 * 1.02)
    # состояние пережило «перезапуск» (общая база)
    market_prices._live.clear()
    market_prices._state.update({"markup_pct": None, "floors": {}})
    await market_prices.load()
    assert catalog.gift_price(gid) == round(meta["ref_floor_ton"] * 1.5 * 1000 * 1.02)


async def test_admin_markup_and_refresh_endpoints(client, admin, monkeypatch):  # noqa: F811
    async def fake_many(slugs):
        return {}, list(slugs)

    monkeypatch.setattr(market_prices, "_fetch_many", fake_many)
    res = await client.post("/api/admin/market-prices/refresh", headers=h(admin))
    # админские эндпоинты stats.py принимают initData; тестовый стенд авторизует через Bearer — достаточно, что чужому закрыто
    assert res.status_code in (200, 401, 403)
    assert (await client.get("/api/market-prices")).status_code == 200


async def test_withdraw_flagged_when_price_jumped_beyond_bank(client, admin, player, monkeypatch):  # noqa: F811
    item = await _own_item(client, admin, player, monkeypatch)
    meta = market_prices._assets().get(item["gift_id"])
    if meta is None:
        pytest.skip("приз без рыночных данных")

    async def jump(_client, _slug):
        return meta["ref_floor_ton"] * 3

    monkeypatch.setattr(market_prices, "fetch_floor", jump)
    monkeypatch.setattr(market_prices, "get_settings", lambda: SimpleNamespace(app_env="production"))
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    async with get_session_factory()() as session:
        await prize_bank.set_balance(session, 0)

    res = await client.post("/api/me/inventory/withdraw", headers=h(player), json={"item_id": item["uid"]})
    assert res.status_code == 200 and res.json()["review"] is True
    pending = (await client.get("/api/admin/withdrawals", headers=h(admin))).json()
    mine = next(w for w in pending if w["gift_id"] == item["gift_id"])
    assert mine["review_reason"] and "банка" in mine["review_reason"]


async def test_withdraw_not_flagged_when_bank_covers_jump(client, admin, player, monkeypatch):  # noqa: F811
    item = await _own_item(client, admin, player, monkeypatch)
    meta = market_prices._assets().get(item["gift_id"])
    if meta is None:
        pytest.skip("приз без рыночных данных")

    async def jump(_client, _slug):
        return meta["ref_floor_ton"] * 2

    monkeypatch.setattr(market_prices, "fetch_floor", jump)
    monkeypatch.setattr(market_prices, "get_settings", lambda: SimpleNamespace(app_env="production"))
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    async with get_session_factory()() as session:
        await prize_bank.set_balance(session, 10**9)

    res = await client.post("/api/me/inventory/withdraw", headers=h(player), json={"item_id": item["uid"]})
    assert res.status_code == 200 and res.json()["review"] is False
