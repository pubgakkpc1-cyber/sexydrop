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
