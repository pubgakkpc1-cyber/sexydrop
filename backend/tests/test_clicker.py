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


async def test_boost_ton_purchase_and_paid_stars_boost(client) -> None:
    from app.core.db import get_session_factory
    from tests.test_economy import give, h, login

    adm = await login(client, username="zapixxgarant")
    pl = await login(client)
    await give(client, adm, pl, "3")
    ok = await client.post("/api/clicker/boost", headers=h(pl), json={"level": 2, "currency": "ton"})
    assert ok.status_code == 200 and ok.json()["mult"] == 2 and ok.json()["balance_minor"] == 2500
    again = await client.post("/api/clicker/boost", headers=h(pl), json={"level": 2, "currency": "ton"})
    assert again.status_code == 409 and again.json()["code"] == "boost_active"
    st = (await client.get("/api/clicker/state", headers=h(pl))).json()["boost"]
    assert [(lv["mult"], lv["status"]) for lv in st["levels"]] == [(2, "owned"), (3, "available")]
    assert st["levels"][1]["stars"] == 50  # с x2 до x3 доплата только разница
    tap = await client.post("/api/clicker/tap", headers=h(pl), json={"taps": 5})
    assert tap.json()["mult"] == 2 and tap.json()["gain"] == 2 * tap.json()["accepted"]
    # оплата Telegram Stars до x3: payload sd-boost-3-…, сумма 50 (разница)
    tg = pl["_tg"]
    async with get_session_factory()() as session:
        assert await clicker.apply_paid_boost(session, tg, 3, 50, "charge-1") is True
    async with get_session_factory()() as session:
        assert await clicker.apply_paid_boost(session, tg, 3, 50, "charge-1") is False  # тот же платёж повторно
    st = (await client.get("/api/clicker/state", headers=h(pl))).json()["boost"]
    assert [(lv["mult"], lv["status"]) for lv in st["levels"]] == [(2, "above"), (3, "owned")]
    # недоплата не включает усиление
    other = await login(client)
    async with get_session_factory()() as session:
        assert await clicker.apply_paid_boost(session, other["_tg"], 3, 10, "charge-2") is False
