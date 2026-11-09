import asyncio

from sqlalchemy import text

from app.core import catalog
from app.core.db import get_session_factory
from app.services import prize_bank


def _entries():
    case = next(c for c in (catalog.get_case(cid) for cid in ("farm", "gem", "romance", "autumn")) if c and len(c.entries) > 3)
    return list(case.entries)


async def _set_bank(minor: int) -> None:
    async with get_session_factory()() as session:
        await prize_bank.set_balance(session, minor)


async def _bank() -> int:
    async with get_session_factory()() as session:
        v = await prize_bank.available(session)
        await session.commit()
        return v


async def test_empty_bank_drops_only_two_cheapest(client, monkeypatch):
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    await _set_bank(0)
    entries = _entries()
    cheapest_two = {e[0] for e in sorted(entries, key=lambda e: prize_bank.cost_of(e[0]))[:2]}
    seen = set()
    for _ in range(60):
        async with get_session_factory()() as session:
            seen.add(await prize_bank.pick(session, entries))
            await session.commit()
    assert seen <= cheapest_two
    assert await _bank() == 0


async def test_prize_never_costs_more_than_bank_and_is_debited(client, monkeypatch):
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    entries = _entries()
    mid = sorted(prize_bank.cost_of(e[0]) for e in entries)[len(entries) // 2]
    await _set_bank(mid)
    cheapest_two = {e[0] for e in sorted(entries, key=lambda e: prize_bank.cost_of(e[0]))[:2]}
    for _ in range(40):
        async with get_session_factory()() as session:
            before = await prize_bank.available(session)
            prize = await prize_bank.pick(session, entries)
            cost = prize_bank.cost_of(prize)
            assert cost <= before or prize in cheapest_two
            await session.commit()
        assert await _bank() == max(0, before - cost)


async def test_two_players_at_once_cannot_spend_same_bank_twice(client, monkeypatch):
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    entries = _entries()
    priciest = max(entries, key=lambda e: prize_bank.cost_of(e[0]))[0]
    price = prize_bank.cost_of(priciest)
    rigged = [(priciest, 10**12)] + [e for e in entries if e[0] != priciest]
    await _set_bank(price)  # хватает ровно на один самый дорогой приз

    async def spin() -> str:
        async with get_session_factory()() as session:
            prize = await prize_bank.pick(session, rigged)
            await asyncio.sleep(0.05)  # второй игрок успевает прийти, пока первый не закоммитил
            await session.commit()
            return prize

    results = await asyncio.gather(spin(), spin())
    assert results.count(priciest) == 1
    assert await _bank() == 0


async def test_cap_payout_limits_profit_to_bank(client, monkeypatch):
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    await _set_bank(500)
    async with get_session_factory()() as session:
        assert await prize_bank.cap_payout(session, 1000, 5000) == 1500  # ставка + весь банк
        await session.commit()
    assert await _bank() == 0
    async with get_session_factory()() as session:
        assert await prize_bank.cap_payout(session, 1000, 5000) == 1000  # банк пуст: только ставка назад
        await session.commit()
