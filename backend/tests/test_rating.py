from datetime import datetime, timedelta, timezone

from app.services import rating


def test_season_is_30_days_and_rolls_on():
    start = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)
    assert rating.index_at(start, start) == 0
    assert rating.index_at(start, start + timedelta(days=29, hours=23)) == 0
    assert rating.index_at(start, start + timedelta(days=30)) == 1
    s, e = rating.window(start, 1)
    assert s == start + timedelta(days=30) and e == start + timedelta(days=60)


def test_prizes_match_the_rules():
    assert [(p["place"], p["ton_minor"], p["nft"]) for p in rating.PRIZES] == [(1, 10000, True), (2, 10000, False), (3, 5000, False)]


def test_board_view_marks_me_and_outside_rank():
    rows = [{"user_id": i, "name": f"u{i}", "avatar": None, "value": 100 - i} for i in range(40)]
    view = rating._board_view(rows, 35)
    assert len(view["top"]) == rating.TOP_SIZE and view["me"] == {"rank": 36, "value": 65}
    assert view["me_outside"]["rank"] == 36
    assert rating._board_view(rows, 2)["me_outside"] is None
