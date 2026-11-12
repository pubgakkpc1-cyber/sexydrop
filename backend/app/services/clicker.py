"""Кликалка: бесплатная мини-игра в боте. Считаем тапы на сервере (с защитой от автокликеров) и месячный топ.

Хранение: UserMeta.quests_claimed["_clicker"] = {"total", "month", "month_clicks", "last_ms", "best_cps"}.
Лимит: не больше MAX_CPS тапов в секунду от времени между запросами; клиент шлёт пачки раз в ~1 секунду.
Награда лидерам недели — решение владельца проекта (в приложении об этом честно сказано), здесь только честный счёт.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.economy import UserMeta
from app.models.user import User
from app.services.economy_core import GameError, ensure_account, post_ledger

MAX_CPS = 8  # человек физически не тапает быстрее; выше — автокликер, лишнее отбрасываем
MAX_BATCH = 60
BURST_ALLOWANCE = 8  # первая пачка / после паузы
TOP_SIZE = 30
REF_CLICKS = 200  # клики инвайтеру за друга без Premium
REF_CLICKS_PREMIUM = 300  # за друга с Premium
REF_DAILY_MAX = 5  # сколько рефералов в день дают клики
KEY = "_clicker"

# Усиления тапа на сезон (30 дней): x2 за 50 ★ или 0.5 TON, x3 за 100 ★ или 1 TON (TON — в minor: 1 TON = 1000)
BOOSTS: dict[int, dict[str, int]] = {2: {"stars": 50, "minor": 500}, 3: {"stars": 100, "minor": 1000}}


def active_mult(c: dict[str, Any]) -> int:
    """Во сколько раз усилен тап в текущем сезоне (1 — без усиления)."""
    b = c.get("boost") or {}
    return int(b.get("mult", 1)) if b.get("season") == month_key() else 1


def boost_price(current: int, level: int) -> dict[str, int]:
    """Цена усиления; если уже есть x2, до x3 доплачивается только разница."""
    base = BOOSTS[level]
    paid = BOOSTS.get(current, {"stars": 0, "minor": 0})
    return {"stars": base["stars"] - paid["stars"], "minor": base["minor"] - paid["minor"]}


def _now_ms() -> int:
    return int(time.time() * 1000)


# Марафон идёт сезонами ровно по 30 дней, первый сезон стартует 9 ноября 2026, 00:00 МСК (= 8 ноября 21:00 UTC).
SEASON_DAYS = 30
SEASON_ANCHOR = datetime(2026, 11, 8, 21, 0, tzinfo=timezone.utc)

# Призы сезона (TON — в minor, 1 TON = 1000): 1 место — NFT-подарок и 5 TON, 2 место — 5 TON, 3 место — 3 TON.
PRIZES: list[dict[str, Any]] = [
    {"place": 1, "ton_minor": 5000, "nft": True},
    {"place": 2, "ton_minor": 5000, "nft": False},
    {"place": 3, "ton_minor": 3000, "nft": False},
]


def season_index(now: datetime | None = None) -> int:
    delta = (now or datetime.now(timezone.utc)) - SEASON_ANCHOR
    return max(0, delta.days // SEASON_DAYS)


def month_key(now: datetime | None = None) -> str:
    """Ключ текущего сезона (30 дней): «S0», «S1», …"""
    return f"S{season_index(now)}"


def month_ends_at(now: datetime | None = None) -> int:
    """Когда закончится текущий сезон (секунды)."""
    return int((SEASON_ANCHOR + timedelta(days=SEASON_DAYS * (season_index(now) + 1))).timestamp())


def allowed_taps(requested: int, elapsed_ms: int | None) -> int:
    """Сколько тапов из пачки засчитываем: не больше MAX_CPS в секунду от прошедшего времени."""
    requested = max(0, min(int(requested), MAX_BATCH))
    if elapsed_ms is None or elapsed_ms > 5000:
        cap = BURST_ALLOWANCE
    else:
        cap = int(max(0, elapsed_ms) / 1000 * MAX_CPS) + 1
    return min(requested, cap)


async def _meta(session: AsyncSession, user: User) -> UserMeta:
    await ensure_account(session, user.id)
    return (await session.execute(select(UserMeta).where(UserMeta.user_id == user.id).with_for_update())).scalar_one()


def _display(first: str | None, last: str | None) -> str:
    name = " ".join(p.strip() for p in (first, last) if p and p.strip())
    return name[:30] or "Игрок"


SUS_THRESHOLD = 3  # столько «звоночков» — и игрок попадает в список подозрительных в админке


def _watch(c: dict[str, Any], now: int, *, requested: int, accepted: int, gap: int | None) -> None:
    """Эвристики автокликера. Тапы не блокируем, только копим «звоночки» для админа (c["sus"]).

    1) пачки, где просили заметно больше лимита человека (клиент шлёт столько, сколько не нажать пальцем);
    2) долгая серия пачек ровно на максимуме скорости (человек так минуту подряд не держит);
    3) непрерывный клик больше 20 минут без пауз.
    """
    sus = dict(c.get("sus") or {})
    reasons = dict(sus.get("reasons") or {})
    if requested >= 12 and requested > accepted * 1.5:
        sus["over_cap"] = int(sus.get("over_cap", 0)) + 1
        if sus["over_cap"] in (5, 20, 80):
            reasons["too_fast"] = "быстрее лимита человека"
            sus["score"] = int(sus.get("score", 0)) + 1
    maxed = accepted >= MAX_CPS - 1 and gap is not None and 700 <= gap <= 1500
    sus["maxed_streak"] = int(sus.get("maxed_streak", 0)) + 1 if maxed else 0
    if sus["maxed_streak"] == 60:
        reasons["steady_max"] = "минуту подряд ровно на максимуме скорости"
        sus["score"] = int(sus.get("score", 0)) + 1
    if gap is None or gap > 120_000:
        sus["run_start"] = now
    elif now - int(sus.get("run_start") or now) > 20 * 60_000 and not reasons.get("no_break"):
        reasons["no_break"] = "кликает 20+ минут без пауз"
        sus["score"] = int(sus.get("score", 0)) + 1
    if reasons:
        sus["reasons"] = reasons
        sus["last"] = now
    c["sus"] = sus


async def suspicious(session: AsyncSession, min_score: int = 1) -> list[dict[str, Any]]:
    """Игроки со «звоночками» автокликера (для админки), самые подозрительные первыми."""
    rows = (
        await session.execute(select(UserMeta.quests_claimed, User.telegram_id, User.first_name, User.last_name, User.username).join(User, User.id == UserMeta.user_id))
    ).all()
    out = []
    for q, tg, fn, ln, un in rows:
        c = (q or {}).get(KEY) or {}
        sus = c.get("sus") or {}
        score = int(sus.get("score", 0))
        if score >= min_score:
            out.append({
                "telegram_id": int(tg), "name": _display(fn, ln), "username": un, "score": score,
                "flagged": score >= SUS_THRESHOLD, "reasons": list((sus.get("reasons") or {}).values()),
                "total": int(c.get("total", 0)), "month_clicks": int(c.get("month_clicks", 0)), "last": int(sus.get("last", 0)),
            })
    out.sort(key=lambda r: (-r["score"], -r["total"]))
    return out


async def tap(session: AsyncSession, user: User, taps: int) -> dict[str, Any]:
    meta = await _meta(session, user)
    claimed = dict(meta.quests_claimed or {})
    c = dict(claimed.get(KEY) or {})
    now = _now_ms()
    mk = month_key()
    if c.get("month") != mk:
        if c.get("month"):
            c["prev_season"], c["prev_clicks"] = c["month"], int(c.get("month_clicks", 0))
        c["month"], c["month_clicks"] = mk, 0
    await _settle(session, c)
    last = int(c.get("last_ms") or 0)
    gap = now - last if last else None
    ok = allowed_taps(taps, gap)
    _watch(c, now, requested=max(0, min(int(taps), MAX_BATCH)), accepted=ok, gap=gap)
    mult = active_mult(c)
    gain = ok * mult  # купленное усиление умножает очки за каждый засчитанный тап (скорость тапов по-прежнему режется)
    c["total"] = int(c.get("total", 0)) + gain
    c["month_clicks"] = int(c.get("month_clicks", 0)) + gain
    c["last_ms"] = now
    claimed[KEY] = c
    meta.quests_claimed = claimed
    await session.commit()
    return {"accepted": ok, "gain": gain, "mult": mult, "total": c["total"], "month_clicks": c["month_clicks"]}


async def buy_boost(session: AsyncSession, user: User, level: int, currency: str) -> dict[str, Any]:
    """Купить усиление тапа на текущий сезон за звёзды или TON (списание на сервере, без повторов)."""
    if level not in BOOSTS or currency not in ("stars", "ton"):
        raise GameError("bad_boost", 400, "Такого усиления нет")
    meta = await _meta(session, user)
    claimed = dict(meta.quests_claimed or {})
    c = dict(claimed.get(KEY) or {})
    mk = month_key()
    current = active_mult(c)
    if current >= level:
        raise GameError("boost_active", 409, f"Усиление x{current} уже действует до конца сезона")
    price = boost_price(current, level)
    if currency == "stars":
        if int(meta.stars) < price["stars"]:
            raise GameError("insufficient_stars", 409, f"Не хватает звёзд: нужно {price['stars']} ★")
        meta.stars = int(meta.stars) - price["stars"]
    else:
        await post_ledger(
            session, user.id, type="clicker_boost", direction="debit", minor=price["minor"],
            key=f"clicker-boost:{user.id}:{mk}:{level}", description=f"Кликалка: усиление x{level}",
        )
    if c.get("month") != mk:
        c["month"], c["month_clicks"] = mk, 0
    c["boost"] = {"mult": level, "season": mk}
    claimed[KEY] = c
    meta.quests_claimed = claimed
    await session.commit()
    return {"status": "ok", "mult": level, "stars": int(meta.stars), "ends_at": month_ends_at()}


async def state(session: AsyncSession, user: User) -> dict[str, Any]:
    meta = await _meta(session, user)
    mk = month_key()
    mine = dict((meta.quests_claimed or {}).get(KEY) or {})
    if await _settle(session, mine):
        claimed = dict(meta.quests_claimed or {})
        claimed[KEY] = mine
        meta.quests_claimed = claimed
    my_month = int(mine.get("month_clicks", 0)) if mine.get("month") == mk else 0
    await session.commit()
    rows = (
        await session.execute(select(UserMeta.quests_claimed, User.id, User.first_name, User.last_name, User.photo_url).join(User, User.id == UserMeta.user_id))
    ).all()
    board = []
    for q, uid, fn, ln, photo in rows:
        c = (q or {}).get(KEY) or {}
        if c.get("month") == mk and int(c.get("month_clicks", 0)) > 0:
            board.append((int(c["month_clicks"]), uid, _display(fn, ln), photo if (photo or "").startswith("https://") else None, int(c.get("total", 0))))
    board.sort(key=lambda r: -r[0])
    top = [
        {"rank": i + 1, "name": name, "avatar": photo, "clicks": n, "total": tot, "me": uid == user.id}
        for i, (n, uid, name, photo, tot) in enumerate(board[:TOP_SIZE])
    ]
    my_rank = next((i + 1 for i, r in enumerate(board) if r[1] == user.id), None)
    mine_row = next((r for r in board if r[1] == user.id), None)
    me_out = (
        {"rank": my_rank, "name": mine_row[2], "avatar": mine_row[3], "clicks": mine_row[0], "total": mine_row[4], "me": True}
        if mine_row and my_rank and my_rank > TOP_SIZE
        else None
    )
    return {
        "me_outside": me_out,
        "total": int(mine.get("total", 0)),
        "month_clicks": my_month,
        "rank": my_rank,
        "players": len(board),
        "top": top,
        "month_ends_at": month_ends_at(),
        "season_days": SEASON_DAYS,
        "prizes": PRIZES,
        "max_cps": MAX_CPS,
        "boost": {
            "mult": active_mult(mine),
            "options": [
                {"mult": m, "stars": boost_price(active_mult(mine), m)["stars"], "ton_minor": boost_price(active_mult(mine), m)["minor"]}
                for m in BOOSTS
                if m > active_mult(mine)
            ],
        },
        "referral": {
            "clicks": REF_CLICKS, "clicks_premium": REF_CLICKS_PREMIUM, "daily_max": REF_DAILY_MAX,
            "today": int(mine.get("ref_today", 0)) if mine.get("ref_day") == _msk_day() else 0,
            "earned": int(mine.get("ref_clicks_total", 0)),
            "waiting": len(mine.get("ref_pending") or []),
        },
    }


async def season_standings(session: AsyncSession, season: str) -> list[dict[str, Any]]:
    """Итоговый список сезона (по убыванию кликов): и тех, у кого сезон ещё текущий, и тех, у кого он стал прошлым."""
    rows = (
        await session.execute(select(UserMeta.quests_claimed, User.id, User.telegram_id, User.first_name, User.last_name, User.username).join(User, User.id == UserMeta.user_id))
    ).all()
    out = []
    for q, uid, tg, fn, ln, un in rows:
        c = (q or {}).get(KEY) or {}
        n = 0
        if c.get("month") == season:
            n = int(c.get("month_clicks", 0))
        elif c.get("prev_season") == season:
            n = int(c.get("prev_clicks", 0))
        if n > 0:
            out.append({"user_id": uid, "telegram_id": int(tg), "name": _display(fn, ln), "username": un, "clicks": n})
    out.sort(key=lambda r: -r["clicks"])
    return out


def last_finished_season(now: datetime | None = None) -> str | None:
    idx = season_index(now) - 1
    return f"S{idx}" if idx >= 0 else None


async def pay_season(session: AsyncSession, season: str) -> list[dict[str, Any]]:
    """Начисляет TON призёрам завершённого сезона на баланс (один раз на место: идемпотентно по ключу проводки).

    NFT первому месту выдаёт администратор вручную — об этом приходит отдельная строка в итогах.
    """
    from app.services.economy_core import post_ledger

    board = (await season_standings(session, season))[: len(PRIZES)]
    paid = []
    for prize, row in zip(PRIZES, board):
        await post_ledger(
            session, row["user_id"], type="clicker_prize", direction="credit", minor=int(prize["ton_minor"]),
            key=f"clicker:{season}:{prize['place']}", description=f"Кликалка, сезон {season}: {prize['place']} место",
        )
        paid.append({**row, "place": prize["place"], "ton_minor": prize["ton_minor"], "nft": prize["nft"]})
    await session.commit()
    return paid


def _msk_day() -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=3)).strftime("%Y-%m-%d")


async def add_pending_referral(session: AsyncSession, inviter_user_id, friend_user_id) -> None:
    """Друг перешёл по ссылке: бонус придёт, только когда он откроет бесплатный кейс (проверка в _settle). Коммитит вызывающий."""
    await ensure_account(session, inviter_user_id)
    meta = (
        await session.execute(select(UserMeta).where(UserMeta.user_id == inviter_user_id).with_for_update())
    ).scalar_one()
    claimed = dict(meta.quests_claimed or {})
    c = dict(claimed.get(KEY) or {})
    pend = list(c.get("ref_pending") or [])
    fid = str(friend_user_id)
    if fid not in pend and len(pend) < 100:
        pend.append(fid)
    c["ref_pending"] = pend
    claimed[KEY] = c
    meta.quests_claimed = claimed


async def _settle(session: AsyncSession, c: dict[str, Any]) -> bool:
    """Начисляет клики за друзей, которые уже открыли бесплатный кейс: 200 за друга, 300 с Premium, не больше 5 в сутки (МСК)."""
    import uuid as _uuid

    from app.models.economy import PlayRound

    pend = list(c.get("ref_pending") or [])
    if not pend:
        return False
    day = _msk_day()
    if c.get("ref_day") != day:
        c["ref_day"], c["ref_today"] = day, 0
    changed = False
    left: list[str] = []
    for fid in pend:
        if int(c.get("ref_today", 0)) >= REF_DAILY_MAX:
            left.append(fid)  # лимит на сегодня исчерпан: бонус придёт завтра
            continue
        try:
            fu = _uuid.UUID(fid)
        except ValueError:
            continue
        opened = (
            await session.execute(
                select(PlayRound.id).where(PlayRound.user_id == fu, PlayRound.game == "case", PlayRound.case_id.in_(("free", "free24"))).limit(1)
            )
        ).first()
        if not opened:
            left.append(fid)
            continue
        premium = (await session.execute(select(UserMeta.is_premium).where(UserMeta.user_id == fu))).scalar_one_or_none()
        bonus = REF_CLICKS_PREMIUM if premium else REF_CLICKS
        mk = month_key()
        if c.get("month") != mk:
            if c.get("month"):
                c["prev_season"], c["prev_clicks"] = c["month"], int(c.get("month_clicks", 0))
            c["month"], c["month_clicks"] = mk, 0
        c["ref_today"] = int(c.get("ref_today", 0)) + 1
        c["ref_clicks_total"] = int(c.get("ref_clicks_total", 0)) + bonus
        c["total"] = int(c.get("total", 0)) + bonus
        c["month_clicks"] = int(c.get("month_clicks", 0)) + bonus
        changed = True
    if left != pend:
        c["ref_pending"] = left
        changed = True
    return changed


def admin_view(c: dict[str, Any] | None) -> dict[str, Any]:
    """Данные кликалки одного игрока для админки: тапы, рефералы, подозрение на автокликер."""
    c = c or {}
    sus = c.get("sus") or {}
    score = int(sus.get("score", 0))
    mk = month_key()
    return {
        "total": int(c.get("total", 0)),
        "month_clicks": int(c.get("month_clicks", 0)) if c.get("month") == mk else 0,
        "ref_clicks_total": int(c.get("ref_clicks_total", 0)),
        "ref_today": int(c.get("ref_today", 0)) if c.get("ref_day") == _msk_day() else 0,
        "ref_waiting": len(c.get("ref_pending") or []),
        "score": score,
        "flagged": score >= SUS_THRESHOLD,
        "reasons": list((sus.get("reasons") or {}).values()),
        "over_cap": int(sus.get("over_cap", 0)),
    }


async def players_overview(session: AsyncSession, limit: int = 50) -> list[dict[str, Any]]:
    """Все, кто кликал: тапы за всё время и за марафон, бонус за рефералов, подозрение на автокликер. По убыванию кликов."""
    rows = (
        await session.execute(select(UserMeta.quests_claimed, User.telegram_id, User.first_name, User.last_name, User.username).join(User, User.id == UserMeta.user_id))
    ).all()
    out = []
    for q, tg, fn, ln, un in rows:
        c = (q or {}).get(KEY) or {}
        if int(c.get("total", 0)) <= 0:
            continue
        out.append({"telegram_id": int(tg), "name": _display(fn, ln), "username": un, **admin_view(c)})
    out.sort(key=lambda r: -r["total"])
    return out[:limit]
