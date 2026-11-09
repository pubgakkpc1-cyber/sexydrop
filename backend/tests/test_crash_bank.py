import pytest

from app.core.db import get_session_factory
from app.games.crash_schedule import BETTING_MS
from app.services import crash_play, prize_bank
from sqlalchemy import text


def _round_with_natural_at_least(min_crash: float):
    sch = crash_play.schedule()
    w = 4_000_000
    for k in range(60):
        rid = w * 1000 + k
        if sch.natural_crash_point(rid) >= min_crash:
            return rid
    raise AssertionError("нет подходящего раунда")


async def _insert_bet(rid: int, minor: int, uid, req: str) -> None:
    from app.models.economy import PlayRound
    import uuid

    async with get_session_factory()() as session:
        session.add(PlayRound(id=uuid.uuid4(), user_id=uid, game="crash", request_id=req, bet_minor=minor, status="active", state={"round_id": rid, "kind": "gram"}))
        await session.commit()


async def _fresh_user(client):
    from tests.test_economy import login

    u = await login(client)
    import uuid

    return uuid.UUID(u["_user"]["id"])


async def _decide(rid: int):
    async with get_session_factory()() as session:
        await crash_play.ensure_decided(session, rid)
        await session.commit()
    return crash_play.schedule().round_info(rid).crash_point


async def test_no_bets_round_is_natural(client, monkeypatch):
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    crash_play.reset_for_tests()
    rid = _round_with_natural_at_least(3.0)
    async with get_session_factory()() as session:
        await prize_bank.set_balance(session, 6000)
    assert await _decide(rid) == crash_play.schedule().natural_crash_point(rid)


async def test_bet_below_bank_is_capped_at_bank_over_bet(client, monkeypatch):
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    crash_play.reset_for_tests()
    rid = _round_with_natural_at_least(3.0) + 1
    rid = next(r for r in range(rid, rid + 60) if crash_play.schedule().natural_crash_point(r) >= 3.0)
    uid = await _fresh_user(client)
    async with get_session_factory()() as session:
        await prize_bank.set_balance(session, 6000)
    await _insert_bet(rid, 5000, uid, "bank-a")
    assert await _decide(rid) == pytest.approx(1.20)  # ставка 5, банк 6 -> долетает максимум до x1.20


async def test_bet_above_bank_crashes_between_1_00_and_1_30(client, monkeypatch):
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    crash_play.reset_for_tests()
    sch = crash_play.schedule()
    base = 4_100_000 * 1000
    rid = next(r for r in range(base, base + 80) if sch.natural_crash_point(r) >= 3.0)
    uid = await _fresh_user(client)
    async with get_session_factory()() as session:
        await prize_bank.set_balance(session, 6000)
    await _insert_bet(rid, 7000, uid, "bank-b")
    cp = await _decide(rid)
    assert 1.0 <= cp <= 1.30


async def test_decision_is_stable_and_persisted(client, monkeypatch):
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    crash_play.reset_for_tests()
    sch = crash_play.schedule()
    base = 4_200_000 * 1000
    rid = next(r for r in range(base, base + 80) if sch.natural_crash_point(r) >= 3.0)
    uid = await _fresh_user(client)
    async with get_session_factory()() as session:
        await prize_bank.set_balance(session, 6000)
    await _insert_bet(rid, 7000, uid, "bank-c")
    first = await _decide(rid)
    crash_play.reset_for_tests()  # «другой экземпляр сервера»: память пуста, решение берётся из базы
    async with get_session_factory()() as session:
        await crash_play.load_overrides(session, rid)
    assert crash_play.schedule().round_info(rid).crash_point == first
    async with get_session_factory()() as session:
        row = (await session.execute(text("SELECT value FROM app_settings WHERE key = :k"), {"k": f"crash_cp:{rid}"})).scalar_one_or_none()
    assert row is not None
