"""Админка: список игроков, подробная карточка игрока и общая сводка по пользователям и деньгам."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import Integer, String, cast, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import catalog
from app.core.money import gram_to_minor
from app.models.economy import DepositOrder, NftItem, PlayRound, UserMeta, Withdrawal
from app.models.ledger import Account, Transaction
from app.models.user import User

GAME_LABEL = {"case": "Кейсы", "crash": "Ракета", "mines": "Мины", "upgrade": "Апгрейд"}
PROVIDER_LABEL = {"ton": "TON-кошелёк", "cryptobot": "CryptoBot", "stars": "Stars"}
TX_LABEL = {
    "deposit_ton": "Пополнение TON",
    "deposit_cryptobot": "Пополнение CryptoBot",
    "deposit_stars": "Пополнение Stars",
    "demo_deposit": "Демо-пополнение",
    "admin_credit": "Выдал админ",
    "admin_reset": "Обнуление админом",
    "case_bet": "Открытие кейса",
    "case_win": "Выигрыш в кейсе",
    "free_case_win": "Бесплатный кейс",
    "crash_bet": "Ставка в Ракете",
    "crash_win": "Выигрыш в Ракете",
    "mines_bet": "Ставка в Минах",
    "mines_win": "Выигрыш в Минах",
    "mines_refund": "Возврат в Минах",
    "item_sale": "Продажа подарка",
    "stars_exchange": "Обмен звёзд",
}
ITEM_STATUS_LABEL = {
    "available": "В инвентаре",
    "quest_pending": "Под замком (5 друзей)",
    "withdraw_pending": "Ждёт вывода",
    "withdrawn": "Выведен",
    "sold": "Продан",
    "burned": "Сгорел в апгрейде",
    "expired": "Истёк",
}


# NFT из FREE, который игрок ещё не получил: задание «5 друзей» не выполнено (или срок истёк)
LOCKED_STATUSES = ("quest_pending", "expired")


def _ts(dt: datetime | None) -> int | None:
    return int(dt.timestamp()) if dt else None


def display_name(user: User) -> str:
    name = " ".join(p.strip() for p in (user.first_name, user.last_name) if p and p.strip())
    return name or (f"@{user.username}" if user.username else f"ID {user.telegram_id}")


def _gift_name(gift_id: str) -> str:
    try:
        return catalog.gift_name(gift_id) or gift_id
    except Exception:  # noqa: BLE001 — неизвестный подарок не должен ронять админку
        return gift_id


def _case_name(case_id: str | None) -> str:
    if not case_id:
        return "—"
    case = catalog.get_case(case_id)
    return case.name if case is not None else case_id


# ------------------------------------------------------------------ список

async def players_list(session: AsyncSession, q: str = "", sort: str = "last", limit: int = 100) -> dict[str, Any]:
    """Игроки для списка в админке: имя, юзернейм, баланс, пополнения, оборот, итог. Поиск по имени/@/ID."""
    rounds = (
        select(
            PlayRound.user_id.label("uid"),
            func.coalesce(func.sum(PlayRound.bet_minor), 0).label("wagered"),
            func.coalesce(func.sum(PlayRound.payout_minor), 0).label("paid"),
            func.count().label("rounds"),
        )
        .where(PlayRound.status != "active")
        .group_by(PlayRound.user_id)
        .subquery()
    )
    deps = (
        select(DepositOrder.user_id.label("uid"), func.coalesce(func.sum(DepositOrder.amount_minor), 0).label("dep"))
        .where(DepositOrder.status == "paid")
        .group_by(DepositOrder.user_id)
        .subquery()
    )
    locked = (
        select(NftItem.user_id.label("uid"), func.coalesce(func.sum(NftItem.price_minor), 0).label("val"))
        .where(NftItem.source == "free-case", NftItem.status.in_(LOCKED_STATUSES))
        .group_by(NftItem.user_id)
        .subquery()
    )
    stmt = (
        select(User, rounds.c.wagered, rounds.c.paid, rounds.c.rounds, deps.c.dep, Account.balance, locked.c.val)
        .outerjoin(rounds, rounds.c.uid == User.id)
        .outerjoin(deps, deps.c.uid == User.id)
        .outerjoin(Account, Account.user_id == User.id)
        .outerjoin(locked, locked.c.uid == User.id)
    )
    text = q.strip().lstrip("@").lower()
    if text:
        like = f"%{text}%"
        stmt = stmt.where(
            or_(
                func.lower(User.username).like(like),
                func.lower(User.first_name).like(like),
                func.lower(User.last_name).like(like),
                cast(User.telegram_id, String).like(like),
            )
        )
    order = {
        "last": User.updated_at.desc(),
        "new": User.created_at.desc(),
        "wagered": func.coalesce(rounds.c.wagered, 0).desc(),
        "deposited": func.coalesce(deps.c.dep, 0).desc(),
        "balance": func.coalesce(Account.balance, 0).desc(),
    }.get(sort, User.updated_at.desc())
    total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await session.execute(stmt.order_by(order).limit(min(max(limit, 1), 500)))).all()
    return {
        "total": int(total),
        "rows": [
            {
                "id": str(u.telegram_id),
                "name": display_name(u),
                "username": u.username,
                "photo": u.photo_url if (u.photo_url or "").startswith("https://") else None,
                "first": _ts(u.created_at),
                "last": _ts(u.updated_at or u.created_at),
                "balance": gram_to_minor(bal) if bal is not None else 0,
                "deposited": int(dep or 0),
                "wagered": int(w or 0),
                "delta": int(p or 0) - int(lv or 0) - int(w or 0),
                "rounds": int(n or 0),
            }
            for u, w, p, n, dep, bal, lv in rows
        ],
    }


# ------------------------------------------------------------------ карточка

async def player_detail(session: AsyncSession, telegram_id: int) -> dict[str, Any] | None:
    """Всё по одному игроку: профиль, деньги, игры, кейсы, подарки, друзья, история операций."""
    user = (await session.execute(select(User).where(User.telegram_id == telegram_id))).scalar_one_or_none()
    if user is None:
        return None
    uid = user.id
    meta = await session.get(UserMeta, uid)
    account = (await session.execute(select(Account).where(Account.user_id == uid))).scalar_one_or_none()

    # пополнения
    dep_rows = (
        await session.execute(
            select(DepositOrder.provider, func.count(), func.coalesce(func.sum(DepositOrder.amount_minor), 0))
            .where(DepositOrder.user_id == uid, DepositOrder.status == "paid")
            .group_by(DepositOrder.provider)
        )
    ).all()
    deposits_by = [{"method": PROVIDER_LABEL.get(p, p), "count": int(n), "amount": int(a)} for p, n, a in dep_rows]
    last_deps = (
        await session.execute(
            select(DepositOrder)
            .where(DepositOrder.user_id == uid, DepositOrder.status == "paid")
            .order_by(DepositOrder.paid_at.desc().nullslast())
            .limit(20)
        )
    ).scalars()

    # игры
    game_rows = (
        await session.execute(
            select(
                PlayRound.game,
                func.count(),
                func.coalesce(func.sum(PlayRound.bet_minor), 0),
                func.coalesce(func.sum(PlayRound.payout_minor), 0),
            )
            .where(PlayRound.user_id == uid, PlayRound.status != "active")
            .group_by(PlayRound.game)
        )
    ).all()
    games = [
        {"game": GAME_LABEL.get(g, g), "rounds": int(n), "wagered": int(w), "paid": int(p), "net": int(p) - int(w)}
        for g, n, w, p in game_rows
    ]
    case_rows = (
        await session.execute(
            select(
                PlayRound.case_id,
                func.count(),
                func.coalesce(func.sum(PlayRound.bet_minor), 0),
                func.coalesce(func.sum(PlayRound.payout_minor), 0),
            )
            .where(PlayRound.user_id == uid, PlayRound.game == "case")
            .group_by(PlayRound.case_id)
            .order_by(func.count().desc())
        )
    ).all()
    cases = [
        {"case": _case_name(c), "opens": int(n), "spent": int(s), "prize": int(p)} for c, n, s, p in case_rows
    ]

    # подарки
    items = (
        await session.execute(select(NftItem).where(NftItem.user_id == uid).order_by(NftItem.created_at.desc()).limit(100))
    ).scalars().all()
    received = [it for it in items if it.status not in LOCKED_STATUSES]
    locked_items = [it for it in items if it.status in LOCKED_STATUSES]
    locked_value = sum(int(it.price_minor) for it in locked_items)
    item_counts: dict[str, int] = {}
    for it in received:
        item_counts[it.status] = item_counts.get(it.status, 0) + 1
    locked_out = await _locked_progress(session, uid, meta, locked_items)
    withdrawals = (
        await session.execute(select(Withdrawal).where(Withdrawal.user_id == uid).order_by(Withdrawal.created_at.desc()).limit(20))
    ).scalars()

    # друзья
    invited = (await session.execute(select(func.count()).select_from(User).where(User.referred_by_id == uid))).scalar_one()
    qualified = (
        await session.execute(
            select(func.count())
            .select_from(User)
            .where(
                User.referred_by_id == uid,
                exists().where(PlayRound.user_id == User.id, PlayRound.game == "case", PlayRound.case_id.in_(("free", "free24"))),
            )
        )
    ).scalar_one()
    inviter = await session.get(User, user.referred_by_id) if user.referred_by_id else None

    # история операций по балансу
    txs = (
        await session.execute(
            select(Transaction).where(Transaction.user_id == uid).order_by(Transaction.created_at.desc()).limit(60)
        )
    ).scalars()

    # выигрыш игрока — без NFT под замком (он его ещё не получил)
    for g in games:
        if g["game"] == GAME_LABEL["case"]:
            g["paid"] = max(0, g["paid"] - locked_value)
            g["net"] = g["paid"] - g["wagered"]
    for c in cases:
        if c["case"] == _case_name("free"):
            c["prize"] = max(0, c["prize"] - locked_value)
    wagered = sum(g["wagered"] for g in games)
    paid = sum(g["paid"] for g in games)
    deposited = sum(d["amount"] for d in deposits_by)
    admin_credit = (
        await session.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == uid, Transaction.type == "admin_credit"
            )
        )
    ).scalar_one()
    claimed_meta = dict((meta.quests_claimed if meta else None) or {})
    friend_rows = (
        await session.execute(
            select(
                User.id,
                User.telegram_id,
                User.first_name,
                User.username,
                User.created_at,
                func.coalesce(UserMeta.is_premium, False),
                exists().where(
                    PlayRound.user_id == User.id, PlayRound.game == "case", PlayRound.case_id.in_(("free", "free24"))
                ),
            )
            .outerjoin(UserMeta, UserMeta.user_id == User.id)
            .where(User.referred_by_id == uid)
            .order_by(User.created_at.desc())
            .limit(100)
        )
    ).all()
    out_ids = set(claimed_meta.get("_bank_out", []))
    friends_list = [
        {
            "id": str(tg),
            "name": " ".join((fn or "").split()) or (f"@{un}" if un else f"ID {tg}"),
            "username": un,
            "at": _ts(created),
            "premium": bool(prem),
            "spun": bool(spun),
            "not_in_chat": str(fid) in out_ids,
        }
        for fid, tg, fn, un, created, prem, spun in friend_rows
    ]
    from app.services import tag_quest

    ref_block = {
        "bank": int(claimed_meta.get("_bank", 0) or 0),
        "earned_total": 2 * len(claimed_meta.get("_ref", [])),
        "friends_credited": len(claimed_meta.get("_ref", [])),
        "friends_out_of_chat": len(out_ids),
        "history": list(claimed_meta.get("_ref_log") or [])[:20],
        "friends": friends_list,
        "tag_quest": tag_quest.view(claimed_meta.get("_tag")),
    }
    return {
        "referral": ref_block,
        "profile": {
            "id": str(user.telegram_id),
            "name": display_name(user),
            "username": user.username,
            "photo": user.photo_url if (user.photo_url or "").startswith("https://") else None,
            "first": _ts(user.created_at),
            "last": _ts(user.updated_at or user.created_at),
            "premium": bool(meta.is_premium) if meta else False,
            "inviter": {"id": str(inviter.telegram_id), "name": display_name(inviter)} if inviter else None,
            "invited": int(invited),
            "invited_qualified": int(qualified),
        },
        "money": {
            "balance": gram_to_minor(account.balance) if account else 0,
            "stars": int(meta.stars) if meta else 0,
            "deposited": deposited,
            "deposits_by": deposits_by,
            "admin_credit": gram_to_minor(admin_credit),
            "wagered": wagered,
            "paid": paid,
            "net": paid - wagered,
        },
        "games": games,
        "cases": cases,
        "items": {
            "counts": [{"status": ITEM_STATUS_LABEL.get(k, k), "count": v} for k, v in item_counts.items()],
            "list": [
                {
                    "name": _gift_name(it.gift_id),
                    "gift_id": it.gift_id,
                    "price": int(it.price_minor),
                    "status": ITEM_STATUS_LABEL.get(it.status, it.status),
                    "source": it.source,
                    "at": _ts(it.created_at),
                }
                for it in received[:40]
            ],
            "locked": locked_out,
        },
        "withdrawals": [
            {"name": _gift_name(w.gift_id), "status": w.status, "at": _ts(w.created_at), "done_at": _ts(w.done_at)}
            for w in withdrawals
        ],
        "deposits": [
            {"method": PROVIDER_LABEL.get(d.provider, d.provider), "amount": int(d.amount_minor), "at": _ts(d.paid_at or d.created_at)}
            for d in last_deps
        ],
        "history": [
            {
                "at": _ts(t.created_at),
                "type": TX_LABEL.get(t.type, t.type),
                "sign": 1 if t.direction == "credit" else -1,
                "amount": gram_to_minor(t.amount),
                "balance_after": gram_to_minor(t.balance_after),
                "note": t.description,
            }
            for t in txs
        ],
    }


async def _locked_progress(
    session: AsyncSession, uid: Any, meta: UserMeta | None, locked_items: list[NftItem]
) -> list[dict[str, Any]]:
    """NFT под замком: сколько друзей уже засчитано и сколько осталось пригласить."""
    from app.services import play_service

    quest = ((meta.free_state or {}) if meta else {}).get("quest") or {}
    out: list[dict[str, Any]] = []
    for it in locked_items:
        active = it.status == "quest_pending" and str(quest.get("item_id")) == str(it.id)
        joined = 0
        if active:
            joined = min(
                await play_service.friends_joined(session, uid, int(quest.get("claimed_at", 0))),
                play_service.QUEST_FRIENDS,
            )
        out.append(
            {
                "name": _gift_name(it.gift_id),
                "price": int(it.price_minor),
                "at": _ts(it.created_at),
                "expired": it.status == "expired" or not active,
                "joined": joined,
                "target": play_service.QUEST_FRIENDS,
                "left": max(0, play_service.QUEST_FRIENDS - joined),
                "expires_at": int(quest.get("expires_at", 0)) // 1000 if active else None,
            }
        )
    return out


# ------------------------------------------------------------------ сводка

async def overview_extra(session: AsyncSession) -> dict[str, Any]:
    """Дополнение к общей статистике: пользователи за 7/30 дней, платящие, деньги на балансах, друзья, выводы."""
    now = datetime.now(timezone.utc)

    async def count(stmt: Any) -> int:
        return int((await session.execute(stmt)).scalar_one() or 0)

    users = select(func.count()).select_from(User)
    paid = DepositOrder.status == "paid"
    metas = (await session.execute(select(UserMeta.quests_claimed))).scalars().all()
    banks = sum(int((m or {}).get("_bank", 0) or 0) for m in metas)
    credited = sum(len((m or {}).get("_ref", [])) for m in metas)
    return {
        "ref_banks_total": banks,
        "ref_friends_credited": credited,
        "ref_stars_earned": 2 * credited,
        "users_7d": await count(users.where(User.updated_at >= now - timedelta(days=7))),
        "users_30d": await count(users.where(User.updated_at >= now - timedelta(days=30))),
        "users_new_7d": await count(users.where(User.created_at >= now - timedelta(days=7))),
        "users_premium": await count(select(func.count()).select_from(UserMeta).where(UserMeta.is_premium.is_(True))),
        "users_played": await count(select(func.count(func.distinct(PlayRound.user_id)))),
        "users_paid": await count(select(func.count(func.distinct(DepositOrder.user_id))).where(paid)),
        "users_referred": await count(users.where(User.referred_by_id.is_not(None))),
        "deposited_total": await count(select(func.coalesce(func.sum(DepositOrder.amount_minor), 0)).where(paid)),
        "deposited_24h": await count(
            select(func.coalesce(func.sum(DepositOrder.amount_minor), 0)).where(
                paid, DepositOrder.paid_at >= now - timedelta(days=1)
            )
        ),
        "balances_total": gram_to_minor(
            (await session.execute(select(func.coalesce(func.sum(Account.balance), 0)))).scalar_one()
        ),
        "stars_total": await count(select(func.coalesce(func.sum(cast(UserMeta.stars, Integer)), 0))),
        "withdrawals_pending": await count(
            select(func.count()).select_from(Withdrawal).where(Withdrawal.status == "pending")
        ),
        "withdrawals_done": await count(select(func.count()).select_from(Withdrawal).where(Withdrawal.status == "done")),
    }
