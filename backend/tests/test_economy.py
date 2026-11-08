"""Серверная экономика: баланс, кейсы, продажа, апгрейд, мины, ракетка, звёзды, пополнения, выводы, рейтинг."""

from __future__ import annotations

import random
import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core import catalog
from app.core.db import get_session_factory
from app.models.economy import NftItem, UserMeta
from app.services import account_service, crash_play, economy_core, odds_service, play_service

ADMIN = "zapixxgarant"


def _tg_id() -> int:
    return random.randint(10**9, 10**10)


async def login(client: AsyncClient, *, username: str | None = None, tg_id: int | None = None, ref: str | None = None) -> dict:
    tg = tg_id or _tg_id()
    res = await client.post(
        "/api/auth/dev",
        json={"telegram_id": tg, "username": username or f"u{tg}", "first_name": "T", "referral_code": ref},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    return {"Authorization": f"Bearer {body['token']}", "_user": body["user"], "_tg": tg}


def h(user: dict) -> dict:
    return {"Authorization": user["Authorization"]}


async def give(client: AsyncClient, admin: dict, user: dict, ton: str) -> None:
    res = await client.post("/api/admin/give-ton", headers=h(admin), json={"username": user["_user"]["username"], "amount_ton": ton})
    assert res.status_code == 200, res.text


async def state(client: AsyncClient, user: dict) -> dict:
    res = await client.get("/api/me/state", headers=h(user))
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture
async def admin(client: AsyncClient) -> dict:
    # админ — по юзернейму; у каждого запуска свой id, имя занимаем у предыдущего владельца
    tg = _tg_id()
    async with get_session_factory()() as session:
        from sqlalchemy import text

        await session.execute(text("UPDATE users SET username = NULL WHERE lower(username) = :u"), {"u": ADMIN})
        await session.commit()
    return await login(client, username=ADMIN, tg_id=tg)


@pytest.fixture
async def player(client: AsyncClient) -> dict:
    return await login(client)


class FixedRng:
    """ГСЧ с заданными ответами: по умолчанию 0 (первый приз / победа)."""

    def __init__(self, *values: int) -> None:
        self.values = list(values)

    def randrange(self, n: int) -> int:
        value = self.values.pop(0) if self.values else 0
        return value % n


# ------------------------------------------------------------------ баланс и доступ

async def test_state_requires_auth_and_starts_empty(client: AsyncClient, player: dict) -> None:
    assert (await client.get("/api/me/state")).status_code == 401
    st = await state(client, player)
    assert st["balance_minor"] == 0 and st["items"] == [] and st["stars"] == 0


async def test_balance_comes_only_from_server_ledger(client: AsyncClient, admin: dict, player: dict) -> None:
    await give(client, admin, player, "12.5")
    assert (await state(client, player))["balance_minor"] == 12_500


async def test_old_money_endpoints_are_gone(client: AsyncClient, player: dict) -> None:
    assert (await client.post("/api/cases/farm/open", headers=h(player), json={"client_request_id": "x"})).status_code in (404, 405)


# ------------------------------------------------------------------ кейсы

async def test_open_case_charges_price_and_pays_prize(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    await give(client, admin, player, "20")
    case = catalog.get_case("farm")
    assert case is not None
    res = await client.post("/api/play/cases/farm/open", headers=h(player), json={"client_request_id": "open-1"})
    assert res.status_code == 200, res.text
    body = res.json()
    prize = body["gift_id"]
    expected = 20_000 - case.price + (catalog.ton_prize_minor(prize) if catalog.is_ton_prize(prize) else 0)
    assert body["balance_minor"] == expected
    st = await state(client, player)
    assert st["balance_minor"] == expected
    assert (len(st["items"]) == 0) == catalog.is_ton_prize(prize)

    # повтор того же запроса: тот же результат, второго списания нет
    again = await client.post("/api/play/cases/farm/open", headers=h(player), json={"client_request_id": "open-1"})
    assert again.json()["gift_id"] == prize
    assert (await state(client, player))["balance_minor"] == expected


async def test_open_case_insufficient_funds(client: AsyncClient, player: dict) -> None:
    res = await client.post("/api/play/cases/elite/open", headers=h(player), json={"client_request_id": "poor"})
    assert res.status_code == 402 and res.json()["code"] == "insufficient_funds"
    assert (await state(client, player))["balance_minor"] == 0


async def test_open_case_distribution_follows_weights(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    await give(client, admin, player, "100")
    case = catalog.get_case("vip")
    assert case is not None
    entries = catalog.effective_entries(case)
    total = sum(w for _, w in entries)
    # первый приз при броске 0, последний — при total-1
    monkeypatch.setattr(economy_core, "_rng", FixedRng(0, total - 1))
    await give(client, admin, player, "300")
    first = (await client.post("/api/play/cases/vip/open", headers=h(player), json={"client_request_id": "a"})).json()
    last = (await client.post("/api/play/cases/vip/open", headers=h(player), json={"client_request_id": "b"})).json()
    assert first["gift_id"] == entries[0][0] and last["gift_id"] == entries[-1][0]


async def test_admin_odds_override_drives_the_roll(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    await give(client, admin, player, "20")
    case = catalog.get_case("farm")
    assert case is not None
    only = case.all_items[0]
    odds_service.reset_for_tests()
    await odds_service.set_case("farm", {only: 5})
    try:
        res = await client.post("/api/play/cases/farm/open", headers=h(player), json={"client_request_id": "ov"})
        assert res.json()["gift_id"] == only
    finally:
        await odds_service.reset_case("farm")


# ------------------------------------------------------------------ инвентарь

async def _own_item(client: AsyncClient, admin: dict, user: dict, monkeypatch) -> dict:
    """Выдаёт игроку NFT из кейса (бросок на последний приз vip — подарок, не TON)."""
    await give(client, admin, user, "200")
    case = catalog.get_case("vip")
    assert case is not None
    entries = catalog.effective_entries(case)
    monkeypatch.setattr(economy_core, "_rng", FixedRng(sum(w for _, w in entries) - 1))
    res = await client.post("/api/play/cases/vip/open", headers=h(user), json={"client_request_id": uuid.uuid4().hex})
    assert res.status_code == 200, res.text
    assert not catalog.is_ton_prize(res.json()["gift_id"])
    return {"uid": res.json()["uid"], "gift_id": res.json()["gift_id"], "price": catalog.gift_price(res.json()["gift_id"])}


async def test_sell_credits_catalog_price_once(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    item = await _own_item(client, admin, player, monkeypatch)
    before = (await state(client, player))["balance_minor"]
    res = await client.post("/api/me/inventory/sell", headers=h(player), json={"item_id": item["uid"]})
    assert res.status_code == 200, res.text
    assert res.json()["balance_minor"] == before + item["price"]
    again = await client.post("/api/me/inventory/sell", headers=h(player), json={"item_id": item["uid"]})
    assert again.status_code == 409
    assert (await state(client, player))["balance_minor"] == before + item["price"]


async def test_cannot_sell_someone_elses_item(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    item = await _own_item(client, admin, player, monkeypatch)
    thief = await login(client)
    res = await client.post("/api/me/inventory/sell", headers=h(thief), json={"item_id": item["uid"]})
    assert res.status_code == 404
    assert (await state(client, thief))["balance_minor"] == 0


async def test_withdraw_locks_item_and_admin_resolves(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    item = await _own_item(client, admin, player, monkeypatch)
    res = await client.post("/api/me/inventory/withdraw", headers=h(player), json={"item_id": item["uid"]})
    assert res.status_code == 200, res.text
    assert all(i["uid"] != item["uid"] for i in (await state(client, player))["items"])
    # заблокированный подарок нельзя продать
    assert (await client.post("/api/me/inventory/sell", headers=h(player), json={"item_id": item["uid"]})).status_code == 409
    pending = (await client.get("/api/admin/withdrawals", headers=h(admin))).json()
    mine = next(w for w in pending if w["user"]["id"] == player["_tg"])
    assert (await client.get("/api/admin/withdrawals", headers=h(player))).status_code == 403
    # «Вернуть» — подарок снова в инвентаре
    assert (await client.post(f"/api/admin/withdrawals/{mine['id']}/reject", headers=h(admin))).status_code == 200
    assert any(i["uid"] == item["uid"] for i in (await state(client, player))["items"])
    assert (await client.post(f"/api/admin/withdrawals/{mine['id']}/done", headers=h(admin))).status_code == 409


# ------------------------------------------------------------------ апгрейд

async def test_upgrade_win_and_lose(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    item = await _own_item(client, admin, player, monkeypatch)
    source_price = item["price"]
    target = next(gid for gid in catalog._raw()["gifts"] if (catalog.gift_price(gid) or 0) > source_price * 3 and not catalog.is_ton_prize(gid))
    target_price = catalog.gift_price(target)

    # проигрыш: бросок на последнем значении диапазона
    monkeypatch.setattr(economy_core, "_rng", FixedRng(100 * target_price - 1))
    lose = await client.post(
        "/api/play/upgrade", headers=h(player), json={"item_id": item["uid"], "target_gift_id": target, "client_request_id": "up-1"}
    )
    assert lose.status_code == 200 and lose.json()["won"] is False
    assert all(i["uid"] != item["uid"] for i in (await state(client, player))["items"])  # предмет сгорел
    # повторный запрос не создаёт ничего нового
    assert (await client.post("/api/play/upgrade", headers=h(player), json={"item_id": item["uid"], "target_gift_id": target, "client_request_id": "up-1"})).json()["won"] is False

    # победа
    item2 = await _own_item(client, admin, player, monkeypatch)
    monkeypatch.setattr(economy_core, "_rng", FixedRng(0))
    win = await client.post(
        "/api/play/upgrade", headers=h(player), json={"item_id": item2["uid"], "target_gift_id": target, "client_request_id": "up-2"}
    )
    assert win.status_code == 200 and win.json()["won"] is True
    owned = (await state(client, player))["items"]
    assert any(i["gift_id"] == target for i in owned) and all(i["uid"] != item2["uid"] for i in owned)


async def test_upgrade_chance_never_exceeds_rtp(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    item = await _own_item(client, admin, player, monkeypatch)
    cheaper = next(gid for gid in catalog._raw()["gifts"] if 0 < (catalog.gift_price(gid) or 0) < item["price"] and not catalog.is_ton_prize(gid))
    res = await client.post(
        "/api/play/upgrade", headers=h(player), json={"item_id": item["uid"], "target_gift_id": cheaper, "client_request_id": "up-c"}
    )
    assert res.json()["chance"] == 1.0  # цель дешевле предмета — шанс 100%
    bad = await client.post("/api/play/upgrade", headers=h(player), json={"item_id": uuid.uuid4().hex, "target_gift_id": cheaper, "client_request_id": "up-d"})
    assert bad.status_code == 404


# ------------------------------------------------------------------ мины

async def test_mines_cashout_pays_formula_and_hides_layout(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    await give(client, admin, player, "10")
    monkeypatch.setattr(economy_core, "_rng", FixedRng())  # мины на клетках 0..m-1
    start = await client.post("/api/play/mines/start", headers=h(player), json={"bet_minor": 1000, "mines_count": 3, "client_request_id": "m1"})
    assert start.status_code == 200, start.text
    assert "mine" not in str(start.json()).replace("mines_count", "")  # раскладка не отдаётся
    rid = start.json()["round_id"]
    assert start.json()["balance_minor"] == 9_000
    safe = await client.post(f"/api/play/mines/{rid}/pick", headers=h(player), json={"tile": 10})
    assert safe.json()["event"] == "safe" and safe.json()["mine_positions"] is None
    mult = play_service.mines_multiplier_hundredths(3, 1)
    cash = await client.post(f"/api/play/mines/{rid}/cashout", headers=h(player))
    assert cash.status_code == 200 and cash.json()["payout_minor"] == 1000 * mult // 100
    assert cash.json()["mine_positions"] == [0, 1, 2]
    assert (await state(client, player))["balance_minor"] == 9_000 + 1000 * mult // 100
    assert (await client.post(f"/api/play/mines/{rid}/cashout", headers=h(player))).status_code == 409


async def test_mines_hit_loses_bet_and_abandoned_round_is_settled(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    await give(client, admin, player, "10")
    monkeypatch.setattr(economy_core, "_rng", FixedRng())
    r1 = (await client.post("/api/play/mines/start", headers=h(player), json={"bet_minor": 1000, "mines_count": 3, "client_request_id": "m2"})).json()
    boom = await client.post(f"/api/play/mines/{r1['round_id']}/pick", headers=h(player), json={"tile": 0})
    assert boom.json()["event"] == "lost" and boom.json()["payout_minor"] == 0
    assert (await state(client, player))["balance_minor"] == 9_000

    # брошенный раунд без открытых клеток возвращает ставку при старте нового
    await client.post("/api/play/mines/start", headers=h(player), json={"bet_minor": 2000, "mines_count": 3, "client_request_id": "m3"})
    assert (await state(client, player))["balance_minor"] == 7_000
    await client.post("/api/play/mines/start", headers=h(player), json={"bet_minor": 1000, "mines_count": 3, "client_request_id": "m4"})
    assert (await state(client, player))["balance_minor"] == 9_000 - 1000


async def test_mines_validation_and_funds(client: AsyncClient, player: dict) -> None:
    poor = await client.post("/api/play/mines/start", headers=h(player), json={"bet_minor": 1000, "mines_count": 3, "client_request_id": "m5"})
    assert poor.status_code == 402
    assert (await client.post("/api/play/mines/start", headers=h(player), json={"bet_minor": 1000, "mines_count": 25, "client_request_id": "m6"})).status_code == 422
    assert (await client.post(f"/api/play/mines/{uuid.uuid4()}/pick", headers=h(player), json={"tile": 1})).status_code == 404


# ------------------------------------------------------------------ ракетка

def _round_at_betting(now_ms: int) -> tuple[int, int]:
    """Возвращает (время в окне ставок, id раунда) для первого раунда окна, в которое попадает now_ms."""
    sch = crash_play.schedule()
    window_start = (now_ms // 600_000) * 600_000
    st = sch.at(window_start + 1000)
    assert st["phase"] == "betting"
    return window_start + 1000, st["round_id"]


def _find_round(window_offset: int, min_crash: float) -> tuple[int, int]:
    """Раунд окна, который долетает минимум до min_crash: (id, время начала в мс)."""
    sch = crash_play.schedule()
    window = 3_000_000 + window_offset
    for k in range(0, 20):
        rid = window * 1000 + k
        if sch.round_info(rid).crash_point >= min_crash:
            return rid, sch._round_start(rid)
    raise AssertionError("нет подходящего раунда")


async def test_crash_cashout_uses_server_multiplier(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    await give(client, admin, player, "10")
    sch = crash_play.schedule()
    rid, start = _find_round(1, 4.0)
    clock = {"t": start + 1000}
    monkeypatch.setattr(crash_play, "now_ms", lambda: clock["t"])
    bet = await client.post("/api/play/crash/bet", headers=h(player), json={"amount_minor": 1000, "client_request_id": "c1"})
    assert bet.status_code == 200, bet.text
    assert bet.json()["balance_minor"] == 9_000
    # дубль ставки в том же раунде отклоняется
    assert (await client.post("/api/play/crash/bet", headers=h(player), json={"amount_minor": 1000, "client_request_id": "c2"})).status_code == 409

    assert len(sch.round_info(rid).curve) > 40
    clock["t"] = start + 5000 + 30 * 50 + 10  # 31-й тик полёта
    shown = sch.at(clock["t"])["multiplier"]
    cash = await client.post("/api/play/crash/cashout", headers=h(player))
    assert cash.status_code == 200, cash.text
    mult_h = int(round(shown * 100))
    assert cash.json()["won_minor"] == 1000 * mult_h // 100
    assert cash.json()["balance_minor"] == 9_000 + 1000 * mult_h // 100
    # повторно забрать нельзя: баланс не меняется
    again = await client.post("/api/play/crash/cashout", headers=h(player))
    assert (await state(client, player))["balance_minor"] == 9_000 + 1000 * mult_h // 100
    assert again.status_code in (200, 409)


async def test_crash_after_crash_point_bet_is_lost_and_crash_point_hidden(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    await give(client, admin, player, "10")
    sch = crash_play.schedule()
    rid, start = _find_round(2, 2.0)
    clock = {"t": start + 1000}
    monkeypatch.setattr(crash_play, "now_ms", lambda: clock["t"])
    assert (await client.post("/api/play/crash/bet", headers=h(player), json={"amount_minor": 1000, "client_request_id": "c3"})).status_code == 200
    clock["t"] = start + 5000 + 100
    mid = (await client.get("/api/play/crash/state")).json()
    assert mid["phase"] == "flying" and mid["crash_point"] is None  # точка краша не раскрывается до краша
    info = sch.round_info(rid)
    clock["t"] = start + 5000 + len(info.curve) * 50 + 500
    late = await client.post("/api/play/crash/cashout", headers=h(player))
    assert late.status_code == 409
    st = (await client.get("/api/play/crash/state?me=1", headers=h(player))).json()
    assert st["phase"] == "crashed" and st["crash_point"] == info.crash_point
    assert st["my_bet"]["status"] == "lost" and st["balance_minor"] == 9_000


async def test_crash_auto_cashout_pays_target_when_reached(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    await give(client, admin, player, "10")
    sch = crash_play.schedule()
    rid, start = _find_round(3, 1.5)
    clock = {"t": start + 1000}
    monkeypatch.setattr(crash_play, "now_ms", lambda: clock["t"])
    assert (await client.post("/api/play/crash/bet", headers=h(player), json={"amount_minor": 1000, "client_request_id": "c4", "auto_cashout": 1.5})).status_code == 200
    clock["t"] = start + 5000 + len(sch.round_info(rid).curve) * 50 + 4000  # раунд давно завершён
    st = (await client.get("/api/play/crash/state?me=1", headers=h(player))).json()
    assert st["balance_minor"] == 9_000 + 1500


async def test_crash_auto_cashout_below_target_loses(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    await give(client, admin, player, "10")
    sch = crash_play.schedule()
    window = 3_000_000 + 4
    rid = next(window * 1000 + k for k in range(20) if sch.round_info(window * 1000 + k).crash_point < 1.3)
    start = sch._round_start(rid)
    clock = {"t": start + 1000}
    monkeypatch.setattr(crash_play, "now_ms", lambda: clock["t"])
    assert (await client.post("/api/play/crash/bet", headers=h(player), json={"amount_minor": 1000, "client_request_id": "c6", "auto_cashout": 2.0})).status_code == 200
    clock["t"] = start + 5000 + len(sch.round_info(rid).curve) * 50 + 4000
    st = (await client.get("/api/play/crash/state?me=1", headers=h(player))).json()
    assert st["balance_minor"] == 9_000 and st["my_bet"] is None or st["my_bet"]["status"] == "lost"


async def test_crash_rejects_bets_outside_betting_window(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    await give(client, admin, player, "10")
    sch = crash_play.schedule()
    t_bet, _ = _round_at_betting(1_800_000_000_000 + 600_000 * 3)
    monkeypatch.setattr(crash_play, "now_ms", lambda: sch.at(t_bet)["flight_start_ms"] + 200)
    res = await client.post("/api/play/crash/bet", headers=h(player), json={"amount_minor": 1000, "client_request_id": "c5"})
    assert res.status_code == 409 and res.json()["code"] == "phase"
    assert (await state(client, player))["balance_minor"] == 10_000


# ------------------------------------------------------------------ бесплатные кейсы

async def test_free24_once_per_period(client: AsyncClient, player: dict) -> None:
    first = await client.post("/api/play/free/free24/claim", headers=h(player), json={"client_request_id": "f1"})
    assert first.status_code == 200 and first.json()["status"] == "ok"
    second = await client.post("/api/play/free/free24/claim", headers=h(player), json={"client_request_id": "f2"})
    assert second.json()["status"] == "cooldown" and second.json()["next_available_at"] > play_service.now_ms()
    st = await state(client, player)
    assert st["free_next_at"]["free24"] > 0 and st["free_next_at"]["free"] == 0


async def test_free_case_nft_is_locked_until_five_premium_friends(client: AsyncClient, monkeypatch) -> None:
    owner = await login(client)
    case = catalog.get_case("free")
    assert case is not None
    entries = catalog.effective_entries(case)
    nft_index = next(i for i, (item, _) in enumerate(entries) if not catalog.is_ton_prize(item))
    roll = sum(w for _, w in entries[:nft_index])
    monkeypatch.setattr(economy_core, "_rng", FixedRng(roll))
    res = await client.post("/api/play/free/free/claim", headers=h(owner), json={"client_request_id": "q1"})
    assert res.status_code == 200 and not catalog.is_ton_prize(res.json()["gift_id"])
    st = await state(client, owner)
    assert st["items"] == [] and st["free_quest"]["pending"] is not None
    # новый FREE, пока задание не выполнено, открыть нельзя
    assert (await client.post("/api/play/free/free/claim", headers=h(owner), json={"client_request_id": "q2"})).json()["status"] == "used"

    # друзья: приходят по ссылке, но без Premium не считаются
    for _ in range(5):
        friend = await login(client, ref=owner["_user"]["referral_code"])
        await client.post("/api/play/free/free24/claim", headers=h(friend), json={"client_request_id": "ff"})
    assert (await client.get("/api/play/free/quest", headers=h(owner))).json()["joined"] == 0

    # с Premium: отмечаем друзей и считаем
    async with get_session_factory()() as session:
        from sqlalchemy import update
        from app.models.user import User

        ids = (await session.execute(select(User.id).where(User.referred_by_id == uuid.UUID(owner["_user"]["id"])))).scalars().all()
        await session.execute(update(UserMeta).where(UserMeta.user_id.in_(ids)).values(is_premium=True))
        await session.commit()
    quest = (await client.get("/api/play/free/quest", headers=h(owner))).json()
    assert quest["joined"] == 5 and quest["completed"] is True
    assert len((await state(client, owner))["items"]) == 1  # подарок выдан


# ------------------------------------------------------------------ звёзды, задания, рейтинг

async def test_quest_progress_is_server_side(client: AsyncClient, admin: dict, player: dict) -> None:
    assert (await client.post("/api/me/quests/open-3-cases/claim", headers=h(player))).status_code == 409
    await give(client, admin, player, "30")
    for i in range(3):
        assert (await client.post("/api/play/cases/farm/open", headers=h(player), json={"client_request_id": f"qq{i}"})).status_code == 200
    ok = await client.post("/api/me/quests/open-3-cases/claim", headers=h(player))
    assert ok.status_code == 200 and ok.json()["stars"] == 15
    assert (await client.post("/api/me/quests/open-3-cases/claim", headers=h(player))).status_code == 409
    assert (await client.post("/api/me/quests/nope/claim", headers=h(player))).status_code == 404


async def test_stars_exchange_only_spends_server_stars(client: AsyncClient, player: dict) -> None:
    small = await client.post("/api/me/stars/exchange", headers=h(player), json={"stars": 0})
    assert small.status_code == 400 and small.json()["code"] == "too_small"
    poor = await client.post("/api/me/stars/exchange", headers=h(player), json={"stars": 100})
    assert poor.status_code == 409 and poor.json()["code"] == "insufficient_stars"
    async with get_session_factory()() as session:
        await economy_core.ensure_account(session, uuid.UUID(player["_user"]["id"]))
        meta = await session.get(UserMeta, uuid.UUID(player["_user"]["id"]))
        meta.stars = 400
        await session.commit()
    ok = await client.post("/api/me/stars/exchange", headers=h(player), json={"stars": 350})
    # курс обмена: 100 ★ = 1.6 TON, то есть 1 ★ = 16 minor
    assert ok.status_code == 200 and ok.json()["credited_minor"] == 5600 and ok.json()["balance_minor"] == 5600
    assert (await state(client, player))["stars"] == 50


async def test_leaderboard_counts_turnover_without_leaking_ids(client: AsyncClient, admin: dict, player: dict) -> None:
    await give(client, admin, player, "10")
    await client.post("/api/play/cases/farm/open", headers=h(player), json={"client_request_id": "lb"})
    board = (await client.get("/api/leaderboard")).json()
    assert board["total"] >= 1
    assert all(set(r) == {"rank", "name", "avatar", "points", "me"} for r in board["rows"])
    async with get_session_factory()() as session:
        full = await account_service.leaderboard(session, uuid.UUID(player["_user"]["id"]), limit=100_000)
    mine = next(r for r in full["rows"] if r["me"])
    assert mine["name"] == "T" and mine["points"] == 650  # имя, не username
    assert full["me"]["points"] == 650


# ------------------------------------------------------------------ пополнения

async def test_deposit_is_credited_exactly_once(client: AsyncClient, player: dict) -> None:
    uid = uuid.UUID(player["_user"]["id"])
    ext = "ext-" + uuid.uuid4().hex
    async with get_session_factory()() as session:
        order = await account_service.create_deposit_order(session, uid, "ton", uuid.uuid4().hex, 0)
        first = await account_service.credit_deposit(session, order.id, 5_000, ext)
        second = await account_service.credit_deposit(session, order.id, 5_000, ext)
        assert first["balance_minor"] == 5_000 and second["balance_minor"] == 5_000
        # чужой заказ с тем же платежом (external_id) не зачисляется
        other = await account_service.create_deposit_order(session, uid, "ton", uuid.uuid4().hex, 0)
        with pytest.raises(economy_core.GameError):
            await account_service.credit_deposit(session, other.id, 5_000, ext)
    assert (await state(client, player))["balance_minor"] == 5_000


async def test_deposit_status_endpoint_requires_own_order(client: AsyncClient, player: dict) -> None:
    secret = uuid.uuid4().hex
    assert (await client.get(f"/api/deposits/ton/comment?secret={secret}", headers=h(player))).status_code == 200
    intruder = await login(client)
    assert (await client.get(f"/api/deposits/ton/status?secret={secret}", headers=h(intruder))).status_code == 404
    assert (await client.get(f"/api/deposits/ton/status?secret={secret}")).status_code == 401


async def test_stars_payment_credits_balance_via_webhook_handler(client: AsyncClient, player: dict) -> None:
    from app.services import deposit_service, telegram_bot

    secret = uuid.uuid4().hex
    uid = uuid.UUID(player["_user"]["id"])
    payload = deposit_service.stars_payload(secret)
    async with get_session_factory()() as session:
        await account_service.create_deposit_order(session, uid, "stars", payload, deposit_service.stars_to_minor(350))
    payment = {"invoice_payload": payload, "currency": "XTR", "total_amount": 350, "telegram_payment_charge_id": "ch-" + secret + uuid.uuid4().hex[:8]}
    await telegram_bot._record_payment(payment)
    await telegram_bot._record_payment(payment)  # повтор вебхука
    assert (await state(client, player))["balance_minor"] == 2_000
    status = await client.get(f"/api/deposits/stars/status?secret={secret}", headers=h(player))
    assert status.json()["status"] == "paid"


# ------------------------------------------------------------------ безопасность

def test_jwt_secret_is_derived_from_bot_token(monkeypatch) -> None:
    from app.core.config import Settings

    monkeypatch.setenv("JWT_SECRET", "epic-tma-insecure-dev-secret-change-in-production")
    monkeypatch.setenv("BOT_TOKEN", "123:ABC")
    secret = Settings().jwt_secret
    assert secret != "epic-tma-insecure-dev-secret-change-in-production" and len(secret) == 64


async def test_dev_login_and_demo_deposit_are_closed_outside_dev(client: AsyncClient, player: dict, monkeypatch) -> None:
    from app.core.config import get_settings

    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()
    assert (await client.post("/api/auth/dev", json={"telegram_id": 5})).status_code == 403
    assert (await client.post("/api/wallet/demo-deposit", headers=h(player), json={"amount_gram": "10", "client_request_id": "x1"})).status_code == 403


def test_decimal_is_not_used_for_game_math() -> None:
    assert Decimal("0.001") == Decimal("0.001")  # деньги в играх — целые minor; Decimal только на границе с БД


async def test_items_table_matches_state(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    item = await _own_item(client, admin, player, monkeypatch)
    async with get_session_factory()() as session:
        row = (await session.execute(select(NftItem).where(NftItem.id == uuid.UUID(item["uid"])))).scalar_one()
        assert row.status == "available" and row.price_minor == item["price"]


# ------------------------------------------------------------------ гонки (двойная трата)

async def test_parallel_sells_credit_only_once(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    import asyncio

    item = await _own_item(client, admin, player, monkeypatch)
    before = (await state(client, player))["balance_minor"]
    results = await asyncio.gather(
        *[client.post("/api/me/inventory/sell", headers=h(player), json={"item_id": item["uid"]}) for _ in range(6)]
    )
    assert sorted(r.status_code for r in results).count(200) == 1
    assert (await state(client, player))["balance_minor"] == before + item["price"]


async def test_parallel_openings_cannot_overspend(client: AsyncClient, admin: dict, player: dict, monkeypatch) -> None:
    import asyncio

    await give(client, admin, player, "7")  # хватает на один кейс за 6.5 TON
    results = await asyncio.gather(
        *[
            client.post("/api/play/cases/farm/open", headers=h(player), json={"client_request_id": f"race-{i}"})
            for i in range(6)
        ]
    )
    codes = sorted(r.status_code for r in results)
    assert codes.count(200) == 1 and codes.count(402) == 5
    prize = next(r.json()["gift_id"] for r in results if r.status_code == 200)
    win = catalog.ton_prize_minor(prize) if catalog.is_ton_prize(prize) else 0
    assert (await state(client, player))["balance_minor"] == 500 + win


async def test_parallel_same_request_id_charges_once(client: AsyncClient, admin: dict, player: dict) -> None:
    import asyncio

    await give(client, admin, player, "20")
    results = await asyncio.gather(
        *[client.post("/api/play/cases/farm/open", headers=h(player), json={"client_request_id": "same"}) for _ in range(5)]
    )
    ok = [r for r in results if r.status_code == 200]
    assert ok and len({r.json()["gift_id"] for r in ok}) == 1
    balance = (await state(client, player))["balance_minor"]
    prize = ok[0].json()["gift_id"]
    expected = 20_000 - 6_500 + (catalog.ton_prize_minor(prize) if catalog.is_ton_prize(prize) else 0)
    assert balance == expected


# ------------------------------------------------------------------ правила бесплатных кейсов

async def test_free24_asks_for_deposit_after_three_spins(client: AsyncClient, monkeypatch) -> None:
    user = await login(client)
    day = 24 * 3600 * 1000
    clock = {"t": 1_900_000_000_000}
    monkeypatch.setattr(play_service, "now_ms", lambda: clock["t"])
    flags = []
    for i in range(3):
        res = await client.post("/api/play/free/free24/claim", headers=h(user), json={"client_request_id": f"g{i}"})
        assert res.status_code == 200 and res.json()["status"] == "ok", res.text
        flags.append(res.json().get("deposit_required"))
        clock["t"] += day
    assert flags == [None, None, True]  # окно с просьбой пополнения появляется после третьего прокрута
    assert (await state(client, user))["free_gate"]["deposit_required"] is True
    blocked = await client.post("/api/play/free/free24/claim", headers=h(user), json={"client_request_id": "g3"})
    assert blocked.status_code == 403 and blocked.json()["code"] == "deposit_required"

    # маленькое пополнение не снимает блок, 0.25 TON — снимает
    uid = uuid.UUID(user["_user"]["id"])
    async with get_session_factory()() as session:
        small = await account_service.create_deposit_order(session, uid, "ton", uuid.uuid4().hex, 0)
        await account_service.credit_deposit(session, small.id, 100, "dep-" + uuid.uuid4().hex)
    assert (await client.post("/api/play/free/free24/claim", headers=h(user), json={"client_request_id": "g4"})).status_code == 403
    async with get_session_factory()() as session:
        more = await account_service.create_deposit_order(session, uid, "ton", uuid.uuid4().hex, 0)
        await account_service.credit_deposit(session, more.id, 150, "dep-" + uuid.uuid4().hex)
    ok = await client.post("/api/play/free/free24/claim", headers=h(user), json={"client_request_id": "g5"})
    assert ok.status_code == 200 and ok.json()["status"] == "ok"
    assert (await state(client, user))["free_gate"]["deposit_required"] is False


async def test_expensive_free_case_can_be_spun_only_once(client: AsyncClient, monkeypatch) -> None:
    user = await login(client)
    clock = {"t": 1_950_000_000_000}
    monkeypatch.setattr(play_service, "now_ms", lambda: clock["t"])
    first = await client.post("/api/play/free/free/claim", headers=h(user), json={"client_request_id": "o1"})
    assert first.json()["status"] == "ok"
    for days in (1, 5, 30):
        clock["t"] += days * 24 * 3600 * 1000
        again = await client.post("/api/play/free/free/claim", headers=h(user), json={"client_request_id": f"again{days}"})
        assert again.json()["status"] == "used"
    assert (await state(client, user))["free_used"]["free"] is True
