import pytest
from httpx import AsyncClient

from app.core import catalog
from app.core.db import get_session_factory
from app.services import economy_core, prize_bank
from tests.test_economy import FixedRng, _own_item, admin, give, h, player, state  # noqa: F401


async def _bank(minor: int) -> None:
    async with get_session_factory()() as session:
        await prize_bank.set_balance(session, minor)


async def _play_mines_until_loss(client: AsyncClient, player: dict, bet: int, rid: str) -> list[int]:
    """Открывает безопасные клетки (мины стоят на 0..2) до слива; возвращает иксы успешных ходов."""
    seen: list[int] = []
    for tile in range(10, 24):
        res = (await client.post(f"/api/play/mines/{rid}/pick", headers=h(player), json={"tile": tile})).json()
        if res["event"] == "lost":
            return seen
        seen.append(res["multiplier_hundredths"])
    raise AssertionError("игра не слилась")


async def test_mines_bet_above_bank_is_flushed_between_1_00_and_1_30(client, admin, player, monkeypatch):
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    await _bank(6000)
    await give(client, admin, player, "20")
    monkeypatch.setattr(economy_core, "_rng", FixedRng())
    start = await client.post("/api/play/mines/start", headers=h(player), json={"bet_minor": 7000, "mines_count": 3, "client_request_id": "bm1"})
    assert start.status_code == 200, start.text
    seen = await _play_mines_until_loss(client, player, 7000, start.json()["round_id"])
    assert all(m <= 130 for m in seen)


async def test_mines_bet_below_bank_is_capped_by_bank(client, admin, player, monkeypatch):
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    await _bank(6000)
    await give(client, admin, player, "20")
    monkeypatch.setattr(economy_core, "_rng", FixedRng())
    start = await client.post("/api/play/mines/start", headers=h(player), json={"bet_minor": 5000, "mines_count": 3, "client_request_id": "bm2"})
    seen = await _play_mines_until_loss(client, player, 5000, start.json()["round_id"])
    assert seen and all(5000 * m // 100 <= 6000 for m in seen)  # выплата ни разу не превысила банк


async def test_mines_work_as_usual_when_bank_is_big(client, admin, player, monkeypatch):
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    await _bank(10_000_000)
    await give(client, admin, player, "20")
    monkeypatch.setattr(economy_core, "_rng", FixedRng())
    start = await client.post("/api/play/mines/start", headers=h(player), json={"bet_minor": 5000, "mines_count": 3, "client_request_id": "bm3"})
    seen = []
    for tile in range(10, 16):
        res = (await client.post(f"/api/play/mines/{start.json()['round_id']}/pick", headers=h(player), json={"tile": tile})).json()
        assert res["event"] == "safe"
        seen.append(res["multiplier_hundredths"])
    assert seen[-1] > 130


async def test_upgrade_above_bank_is_a_loss_and_below_bank_wins(client, admin, player, monkeypatch):
    monkeypatch.setattr(prize_bank, "enabled", lambda: True)
    item = await _own_item(client, admin, player, monkeypatch)
    target = next(g for g in catalog._raw()["gifts"] if (catalog.gift_price(g) or 0) > item["price"] and not catalog.is_ton_prize(g))
    price = catalog.gift_price(target)
    monkeypatch.setattr(economy_core, "_rng", FixedRng(0))  # бросок «на победу»
    await _bank(price - 1)
    lose = await client.post("/api/play/upgrade", headers=h(player), json={"item_id": item["uid"], "target_gift_id": target, "client_request_id": "bu1"})
    assert lose.status_code == 200 and lose.json()["won"] is False  # банк меньше цены подарка

    item2 = await _own_item(client, admin, player, monkeypatch)
    await _bank(price + 5)
    monkeypatch.setattr(economy_core, "_rng", FixedRng(0))
    win = await client.post("/api/play/upgrade", headers=h(player), json={"item_id": item2["uid"], "target_gift_id": target, "client_request_id": "bu2"})
    assert win.status_code == 200 and win.json()["won"] is True
    async with get_session_factory()() as session:
        left = await prize_bank.available(session)
        await session.commit()
    assert left == 5  # цена подарка списана из банка
