import uuid

from app.services import clicker


def test_taps_are_capped_by_human_speed() -> None:
    assert clicker.allowed_taps(500, None) == clicker.BURST_ALLOWANCE  # первая пачка
    assert clicker.allowed_taps(30, 1000) == clicker.MAX_CPS + 1  # за секунду не больше 8 (+1)
    assert clicker.allowed_taps(5, 1000) == 5  # честный игрок не режется
    assert clicker.allowed_taps(10, 0) == 1  # повтор запроса «в ту же миллисекунду» почти ничего не даёт
    assert clicker.allowed_taps(8, 60_000) == 8 and clicker.allowed_taps(50, 60_000) == clicker.BURST_ALLOWANCE  # после паузы — разовый запас


def test_season_is_exactly_30_days() -> None:
    from datetime import datetime, timedelta, timezone

    start = clicker.SEASON_ANCHOR
    assert clicker.month_key(start) == "S0" and clicker.month_key(start + timedelta(days=29, hours=23)) == "S0"
    assert clicker.month_key(start + timedelta(days=30)) == "S1"
    assert clicker.month_ends_at(start) == int((start + timedelta(days=30)).timestamp())
    assert [p["place"] for p in clicker.PRIZES] == [1, 2, 3]
    assert clicker.PRIZES[0]["nft"] is True and clicker.PRIZES[0]["ton_minor"] == 5000


def test_autoclicker_watch_flags_inhuman_batches() -> None:
    c: dict = {}
    for i in range(25):  # каждая пачка просит 60 тапов за секунду
        clicker._watch(c, 1_000_000 + i * 1000, requested=60, accepted=9, gap=1000)
    assert c["sus"]["score"] >= 2 and "too_fast" in c["sus"]["reasons"]
    honest: dict = {}
    for i in range(100):
        clicker._watch(honest, 1_000_000 + i * 1000, requested=5, accepted=5, gap=1000)
    assert honest["sus"].get("score", 0) == 0


def test_boost_prices_and_upgrade_difference() -> None:
    assert clicker.BOOSTS[2] == {"stars": 50, "minor": 500} and clicker.BOOSTS[3] == {"stars": 100, "minor": 1000}
    assert clicker.boost_price(1, 2) == {"stars": 50, "minor": 500}
    assert clicker.boost_price(2, 3) == {"stars": 50, "minor": 500}  # с x2 до x3 доплачивается только разница
    assert clicker.active_mult({}) == 1
    assert clicker.active_mult({"boost": {"mult": 3, "season": clicker.month_key()}}) == 3
    assert clicker.active_mult({"boost": {"mult": 3, "season": "S-old"}}) == 1  # в новом сезоне усиление сгорает


async def test_buying_boost_charges_once_and_multiplies_taps(client) -> None:
    from sqlalchemy import select

    from app.core.db import get_session_factory
    from app.models.economy import UserMeta
    from tests.test_economy import admin, give, h, login, state  # noqa: F401

    adm = await login(client, username="zapixxgarant")
    pl = await login(client)
    await give(client, adm, pl, "3")
    # не хватает звёзд
    poor = await client.post("/api/clicker/boost", headers=h(pl), json={"level": 2, "currency": "stars"})
    assert poor.status_code == 409 and poor.json()["code"] == "insufficient_stars"
    # за TON: 0.5 TON, дубль не проходит
    ok = await client.post("/api/clicker/boost", headers=h(pl), json={"level": 2, "currency": "ton"})
    assert ok.status_code == 200 and ok.json()["mult"] == 2 and ok.json()["balance_minor"] == 2500
    again = await client.post("/api/clicker/boost", headers=h(pl), json={"level": 2, "currency": "ton"})
    assert again.status_code == 409 and again.json()["code"] == "boost_active"
    # тапы засчитываются с множителем
    tap = await client.post("/api/clicker/tap", headers=h(pl), json={"taps": 5})
    assert tap.json()["mult"] == 2 and tap.json()["gain"] == 2 * tap.json()["accepted"]
    # доплата до x3 — только разница (0.5 TON)
    up = await client.post("/api/clicker/boost", headers=h(pl), json={"level": 3, "currency": "ton"})
    assert up.status_code == 200 and up.json()["balance_minor"] == 2000
    # звёзды
    async with get_session_factory()() as session:
        meta = (await session.execute(select(UserMeta).where(UserMeta.user_id == uuid.UUID(pl["_user"]["id"])))).scalar_one()
        assert meta.stars == 0
