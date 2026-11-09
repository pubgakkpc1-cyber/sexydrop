"""Профиль игрока на сервере: состояние, инвентарь (продажа/вывод), звёзды и задания, рейтинг, пополнения."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import catalog
from app.models.economy import DepositOrder, NftItem, PlayRound, UserMeta, Withdrawal
from app.models.user import User
from app.core.config import get_settings
from app.services import play_service, ref_chat, tag_quest
from app.services.economy_core import (
    GameError,
    balance_minor,
    ensure_account,
    item_dict,
    lock_item,
    post_ledger,
)

REFERRAL_BONUS_STARS = 2  # за каждого друга, открывшего бесплатный кейс (один раз за друга)
BANK_MIN_CLAIM = 15  # звёзды за друзей копятся в банке; забрать на баланс звёзд — от 15 ★
STARS_MIN_EXCHANGE = 1  # минимум обмена — 1 звезда

# Задания и награды в Stars (как на клиенте; прогресс считает сервер по своим записям)
QUESTS: dict[str, dict[str, Any]] = {
    "open-3-cases": {"metric": "casesOpened", "target": 3, "stars": 15},
    "mines-10": {"metric": "minesRounds", "target": 10, "stars": 15},
    "upgrade-1": {"metric": "upgrades", "target": 1, "stars": 15},
    "wagered-10": {"metric": "wagered", "target": 10_000, "stars": 50},
    "friend-deposit": {"metric": "friendDeposits", "target": 1, "stars": 50},
}


def stars_to_minor(stars: int) -> int:
    return stars * EXCHANGE_MINOR_PER_STAR


EXCHANGE_MINOR_PER_STAR = 10  # обмен заработанных звёзд: 100 ★ = 1 TON


def exchange_minor(stars: int) -> int:
    return stars * EXCHANGE_MINOR_PER_STAR


async def quest_metrics(session: AsyncSession, user_id: uuid.UUID) -> dict[str, int]:
    def count(*where: Any) -> Any:
        return select(func.count()).select_from(PlayRound).where(PlayRound.user_id == user_id, *where)

    # бесплатные кейсы (FREE, FREE 24) в задания не засчитываются — только платные открытия
    cases = (
        await session.execute(
            count(PlayRound.game == "case", PlayRound.case_id.not_in(("free", "free24")))
        )
    ).scalar_one()
    mines = (
        await session.execute(count(PlayRound.game == "mines", PlayRound.status.in_(("lost", "cashed", "cleared"))))
    ).scalar_one()
    upgrades = (await session.execute(count(PlayRound.game == "upgrade"))).scalar_one()
    wagered = (
        await session.execute(
            select(func.coalesce(func.sum(PlayRound.bet_minor), 0)).where(PlayRound.user_id == user_id)
        )
    ).scalar_one()
    friend_deposits = (
        await session.execute(
            select(func.count())
            .select_from(User)
            .where(
                User.referred_by_id == user_id,
                exists().where(DepositOrder.user_id == User.id, DepositOrder.status == "paid"),
            )
        )
    ).scalar_one()
    return {
        "casesOpened": int(cases),
        "minesRounds": int(mines),
        "upgrades": int(upgrades),
        "wagered": int(wagered),
        "friendDeposits": int(friend_deposits),
    }


def bank_stars(meta: UserMeta) -> int:
    """Звёзды за друзей, ещё не забранные из банка."""
    return int((meta.quests_claimed or {}).get("_bank", 0) or 0)


async def sweep_referral_stars(session: AsyncSession, user_id: uuid.UUID, meta: UserMeta) -> None:
    """Кладёт в банк +2 ★ за каждого друга по ссылке, открывшего бесплатный кейс (один раз за друга).

    Звёзды за друзей копятся в банке (quests_claimed["_bank"]) и переходят на баланс звёзд только
    по кнопке «Забрать», когда в банке от BANK_MIN_CLAIM ★. Коммит — снаружи.
    """
    rows = (
        await session.execute(
            select(User.id, User.first_name, User.username).where(
                User.referred_by_id == user_id,
                exists().where(
                    PlayRound.user_id == User.id, PlayRound.game == "case", PlayRound.case_id.in_(("free", "free24"))
                ),
            )
        )
    ).all()
    claimed = dict(meta.quests_claimed or {})
    credited = set(claimed.get("_ref", []))
    fresh = [r for r in rows if str(r.id) not in credited]
    if fresh:
        claimed["_ref"] = sorted(credited | {str(r.id) for r in fresh})
        # друзья, чьи звёзды лежат в банке — их сервер перепроверяет на участие в чате
        claimed["_bank_ref"] = sorted(set(claimed.get("_bank_ref", [])) | {str(r.id) for r in fresh})
        claimed["_bank"] = int(claimed.get("_bank", 0) or 0) + REFERRAL_BONUS_STARS * len(fresh)
        for r in fresh:
            ref_chat.add_log(claimed, REFERRAL_BONUS_STARS, f"{_friend_name(r.first_name, r.username)} прокрутил бесплатный кейс")
        meta.quests_claimed = claimed


def _friend_name(first_name: str | None, username: str | None) -> str:
    return (first_name or "").strip() or (f"@{username}" if username else "Друг")


async def recheck_bank_friends(session: AsyncSession, meta: UserMeta) -> None:
    """Перепроверка: друзья, чьи звёзды лежат в банке, должны быть в чате SEXY DROP.

    Нет в чате — минус 2 ★ и запись «почему»; вернулся — звёзды обратно. Коммит — снаружи.
    """
    claimed = dict(meta.quests_claimed or {})
    ids = [uuid.UUID(x) for x in claimed.get("_bank_ref", [])]
    if not ids:
        return
    friends = (await session.execute(select(User.id, User.telegram_id, User.first_name, User.username).where(User.id.in_(ids)))).all()
    status = await ref_chat.members([int(f.telegram_id) for f in friends])
    out = set(claimed.get("_bank_out", []))
    bank = int(claimed.get("_bank", 0) or 0)
    changed = False
    for f in friends:
        key, name, inside = str(f.id), _friend_name(f.first_name, f.username), status.get(int(f.telegram_id))
        if inside is False and key not in out:
            out.add(key)
            bank = max(0, bank - REFERRAL_BONUS_STARS)
            ref_chat.add_log(claimed, -REFERRAL_BONUS_STARS, f"{name} не в чате SEXY DROP — звёзды за него сняты")
            changed = True
        elif inside is True and key in out:
            out.discard(key)
            bank += REFERRAL_BONUS_STARS
            ref_chat.add_log(claimed, REFERRAL_BONUS_STARS, f"{name} вступил в чат SEXY DROP — звёзды вернулись")
            changed = True
    if changed:
        claimed["_bank_out"] = sorted(out)
        claimed["_bank"] = bank
        meta.quests_claimed = claimed


async def get_state(session: AsyncSession, user: User) -> dict[str, Any]:
    """Всё, что нужно клиенту после входа: баланс, инвентарь, звёзды, задания, кулдауны бесплатных кейсов."""
    await ensure_account(session, user.id)
    user.updated_at = datetime.now(timezone.utc)  # «последний раз в сети»
    quest = await play_service.quest_status(session, user.id)  # заодно выдаёт выполненный подарок из FREE
    meta = (
        await session.execute(select(UserMeta).where(UserMeta.user_id == user.id).with_for_update())
    ).scalar_one()
    await sweep_referral_stars(session, user.id, meta)
    await session.commit()
    items = (
        await session.execute(
            select(NftItem)
            .where(NftItem.user_id == user.id, NftItem.status == "available")
            .order_by(NftItem.created_at)
        )
    ).scalars()
    free_state = meta.free_state or {}
    cooldowns = {}
    for case_id in ("free", "free24"):
        last = int(free_state.get(case_id, {}).get("last_at", 0))
        cooldowns[case_id] = play_service.free_next_available(last, play_service.now_ms())
    return {
        "balance_minor": await balance_minor(session, user.id),
        "items": [item_dict(i) for i in items],
        "stars": meta.stars,
        "quests_claimed": {k: v for k, v in (meta.quests_claimed or {}).items() if not k.startswith("_")},
        "metrics": await quest_metrics(session, user.id),
        "free_next_at": cooldowns,
        "free_used": {"free": int(free_state.get("free", {}).get("last_at", 0)) > 0},
        "free_gate": {
            "deposit_required": int(free_state.get("free24", {}).get("count", 0)) >= play_service.FREE24_SPINS_BEFORE_DEPOSIT
            and not await play_service.has_unlock_deposit(session, user.id)
        },
        "free_quest": quest,
        "tag_quest": tag_quest.view((meta.quests_claimed or {}).get("_tag")),
        "ref_bank": {
            "stars": bank_stars(meta),
            "min": BANK_MIN_CLAIM,
            "per_friend": REFERRAL_BONUS_STARS,
            "chat_url": get_settings().ref_chat_url,
            "history": list((meta.quests_claimed or {}).get(ref_chat.LOG_KEY) or [])[:20],
        },
        "server_now_ms": play_service.now_ms(),
        "me": {"id": user.telegram_id, "username": user.username, "name": user.first_name},
    }


# ----------------------------------------------------------------- инвентарь

async def sell_item(session: AsyncSession, user_id: uuid.UUID, item_id: str) -> dict[str, Any]:
    await ensure_account(session, user_id)
    item = await lock_item(session, user_id, item_id)
    await play_service.check_quest_item(session, user_id, item, "продать подарок")
    if item.status != "available":
        raise GameError("item_unavailable", 409, "Подарок уже продан или недоступен")
    item.status = "sold"
    new_balance = await post_ledger(
        session, user_id, type="item_sale", direction="credit", minor=item.price_minor, key=f"sell:{item.id}",
        description=f"Продажа {catalog.gift_name(item.gift_id)}",
    )
    await session.commit()
    return {"status": "ok", "credited_minor": item.price_minor, "gift_id": item.gift_id, "balance_minor": new_balance}


async def withdraw_item(session: AsyncSession, user_id: uuid.UUID, item_id: str) -> dict[str, Any]:
    await ensure_account(session, user_id)
    item = await lock_item(session, user_id, item_id)
    await play_service.check_quest_item(session, user_id, item, "вывести подарок")
    if item.status != "available":
        raise GameError("item_unavailable", 409, "Подарок недоступен для вывода")
    item.status = "withdraw_pending"
    row = Withdrawal(id=uuid.uuid4(), user_id=user_id, item_id=item.id, gift_id=item.gift_id)
    session.add(row)
    await session.commit()
    return {"status": "ok", "withdrawal_id": str(row.id), "gift_id": item.gift_id, "name": catalog.gift_name(item.gift_id)}


async def list_withdrawals(session: AsyncSession, status: str = "pending") -> list[dict[str, Any]]:
    rows = (
        await session.execute(
            select(Withdrawal, User)
            .join(User, User.id == Withdrawal.user_id)
            .where(Withdrawal.status == status)
            .order_by(Withdrawal.created_at)
            .limit(200)
        )
    ).all()
    return [
        {
            "id": str(w.id),
            "gift_id": w.gift_id,
            "name": catalog.gift_name(w.gift_id),
            "user": {"id": u.telegram_id, "username": u.username, "name": u.first_name},
            "created_at": w.created_at.isoformat(),
        }
        for w, u in rows
    ]


async def resolve_withdrawal(session: AsyncSession, withdrawal_id: str, *, done: bool) -> dict[str, Any]:
    try:
        wid = uuid.UUID(withdrawal_id)
    except ValueError as exc:
        raise GameError("unknown_withdrawal", 404) from exc
    row = (await session.execute(select(Withdrawal).where(Withdrawal.id == wid).with_for_update())).scalar_one_or_none()
    if row is None:
        raise GameError("unknown_withdrawal", 404)
    if row.status != "pending":
        raise GameError("already_resolved", 409)
    item = (await session.execute(select(NftItem).where(NftItem.id == row.item_id).with_for_update())).scalar_one()
    row.status = "done" if done else "rejected"
    row.done_at = datetime.now(timezone.utc)
    item.status = "withdrawn" if done else "available"
    await session.commit()
    return {"status": row.status}


# ----------------------------------------------------------------- звёзды и задания

async def claim_quest(session: AsyncSession, user_id: uuid.UUID, quest_id: str) -> dict[str, Any]:
    quest = QUESTS.get(quest_id)
    if quest is None:
        raise GameError("unknown_quest", 404)
    await ensure_account(session, user_id)
    meta = (await session.execute(select(UserMeta).where(UserMeta.user_id == user_id).with_for_update())).scalar_one()
    claimed = dict(meta.quests_claimed or {})
    if claimed.get(quest_id):
        raise GameError("already_claimed", 409)
    progress = (await quest_metrics(session, user_id))[quest["metric"]]
    if progress < quest["target"]:
        raise GameError("not_enough", 409, "Задание ещё не выполнено")
    claimed[quest_id] = True
    meta.quests_claimed = claimed
    meta.stars = int(meta.stars) + int(quest["stars"])
    await session.commit()
    return {"status": "ok", "stars": meta.stars, "reward": quest["stars"]}


async def claim_bank(session: AsyncSession, user_id: uuid.UUID) -> dict[str, Any]:
    """Забрать звёзды из банка друзей на баланс звёзд — только если накопилось от BANK_MIN_CLAIM ★."""
    await ensure_account(session, user_id)
    meta = (await session.execute(select(UserMeta).where(UserMeta.user_id == user_id).with_for_update())).scalar_one()
    await sweep_referral_stars(session, user_id, meta)
    # перед выдачей — все друзья из банка должны быть в чате SEXY DROP
    await recheck_bank_friends(session, meta)
    bank = bank_stars(meta)
    if bank < BANK_MIN_CLAIM:
        await session.commit()  # новые друзья, найденные при проверке, уже в банке
        raise GameError("bank_too_small", 409, f"Забрать можно от {BANK_MIN_CLAIM} ★, в банке {bank} ★")
    claimed = dict(meta.quests_claimed or {})
    claimed["_bank"] = 0
    # забранные звёзды больше не перепроверяем
    claimed["_bank_ref"] = []
    claimed["_bank_out"] = []
    ref_chat.add_log(claimed, 0, f"Забрали {bank} ★ на баланс звёзд")
    meta.quests_claimed = claimed
    meta.stars = int(meta.stars) + bank
    await session.commit()
    return {"status": "ok", "claimed": bank, "stars": meta.stars, "bank": 0}


async def exchange_stars(session: AsyncSession, user_id: uuid.UUID, stars: int) -> dict[str, Any]:
    if not isinstance(stars, int) or stars < STARS_MIN_EXCHANGE:
        raise GameError("too_small", 400, "Минимальный обмен — 1 звезда")
    await ensure_account(session, user_id)
    meta = (await session.execute(select(UserMeta).where(UserMeta.user_id == user_id).with_for_update())).scalar_one()
    await sweep_referral_stars(session, user_id, meta)
    if meta.stars < stars:
        raise GameError("insufficient_stars", 409, "Недостаточно звёзд")
    minor = exchange_minor(stars)
    meta.stars = int(meta.stars) - stars
    new_balance = await post_ledger(
        session, user_id, type="stars_exchange", direction="credit", minor=minor,
        description=f"Обмен {stars} Stars",
    )
    await session.commit()
    return {"status": "ok", "credited_minor": minor, "stars": meta.stars, "balance_minor": new_balance}


# ----------------------------------------------------------------- рейтинг

LEADERBOARD_TOP = 20


def _display_name(first_name: str | None, last_name: str | None) -> str:
    """Имя из Telegram («Иван Петров»), без @username."""
    name = " ".join(p.strip() for p in (first_name, last_name) if p and p.strip())
    return name[:40] or "Игрок"


def _safe_photo(url: str | None) -> str | None:
    """Аватарка из initData (t.me/i/userpic/...): отдаём только https-ссылки."""
    return url if url and url.startswith("https://") and len(url) <= 512 else None


async def leaderboard(session: AsyncSession, my_id: uuid.UUID | None, limit: int = LEADERBOARD_TOP) -> dict[str, Any]:
    """Рейтинг всех игроков по обороту (1 TON оборота = 100 очков): имя и аватарка, без username и id."""
    total_bet = func.coalesce(func.sum(PlayRound.bet_minor), 0).label("bet")
    rows = (
        await session.execute(
            select(User.id, User.first_name, User.last_name, User.photo_url, total_bet)
            .outerjoin(PlayRound, PlayRound.user_id == User.id)
            .group_by(User.id)
            .order_by(total_bet.desc(), User.created_at)
        )
    ).all()
    ranked = [
        {
            "rank": i + 1,
            "name": _display_name(r.first_name, r.last_name),
            "avatar": _safe_photo(r.photo_url),
            "points": int(r.bet) // 10,
            "me": my_id is not None and r.id == my_id,
        }
        for i, r in enumerate(rows)
    ]
    me = next(({"rank": r["rank"], "points": r["points"]} for r in ranked if r["me"]), None)
    return {"rows": ranked[:limit], "me": me, "total": len(ranked)}


# ----------------------------------------------------------------- рефералы

async def join_referral(session: AsyncSession, user: User, inviter_telegram_id: int, is_premium: bool) -> bool:
    """Друг перешёл по ссылке: первый пригласивший остаётся навсегда, приглашать себя нельзя."""
    await ensure_account(session, user.id)
    meta = (await session.execute(select(UserMeta).where(UserMeta.user_id == user.id).with_for_update())).scalar_one()
    if is_premium and not meta.is_premium:
        meta.is_premium = True
    registered = False
    if user.referred_by_id is None and inviter_telegram_id != user.telegram_id:
        inviter = (
            await session.execute(select(User).where(User.telegram_id == inviter_telegram_id))
        ).scalar_one_or_none()
        # привязка только к тем, кто зарегистрирован в течение суток (ссылка — для новичков)
        if inviter is not None and user.created_at >= datetime.now(timezone.utc) - timedelta(days=1):
            user.referred_by_id = inviter.id
            registered = True
            from app.services import clicker  # бонусные клики в Кликалке придут, когда друг откроет бесплатный кейс

            await clicker.add_pending_referral(session, inviter.id, user.id)
    await session.commit()
    return registered


async def friends_of(session: AsyncSession, user_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = (
        await session.execute(
            select(
                User.telegram_id,
                func.coalesce(UserMeta.is_premium, False),
                exists().where(
                    PlayRound.user_id == User.id, PlayRound.game == "case", PlayRound.case_id.in_(("free", "free24"))
                ),
            )
            .outerjoin(UserMeta, UserMeta.user_id == User.id)
            .where(User.referred_by_id == user_id)
        )
    ).all()
    return [{"id": str(tg), "premium": bool(prem), "qualified": bool(qual)} for tg, prem, qual in rows]


# ----------------------------------------------------------------- пополнения

async def create_deposit_order(
    session: AsyncSession, user_id: uuid.UUID, provider: str, secret: str, amount_minor: int
) -> DepositOrder:
    await ensure_account(session, user_id)
    existing = (
        await session.execute(
            select(DepositOrder).where(DepositOrder.provider == provider, DepositOrder.secret == secret)
        )
    ).scalar_one_or_none()
    if existing is not None:
        if existing.user_id != user_id:
            raise GameError("secret_taken", 409)
        return existing
    order = DepositOrder(id=uuid.uuid4(), user_id=user_id, provider=provider, secret=secret, amount_minor=amount_minor)
    session.add(order)
    await session.commit()
    return order


async def credit_deposit(
    session: AsyncSession, order_id: uuid.UUID, amount_minor: int, external_id: str | None
) -> dict[str, Any]:
    """Зачисляет оплаченный заказ на баланс ровно один раз."""
    order = (
        await session.execute(select(DepositOrder).where(DepositOrder.id == order_id).with_for_update())
    ).scalar_one()
    if order.status == "paid":
        return {"status": "paid", "amount_minor": order.amount_minor, "balance_minor": await balance_minor(session, order.user_id)}
    if external_id is not None:
        clash = (
            await session.execute(
                select(DepositOrder.id).where(
                    DepositOrder.provider == order.provider, DepositOrder.external_id == external_id
                )
            )
        ).first()
        if clash is not None:
            raise GameError("payment_already_used", 409)
    new_balance = await post_ledger(
        session, order.user_id, type=f"deposit_{order.provider}", direction="credit", minor=amount_minor,
        key=f"deposit:{order.id}", description=f"Пополнение ({order.provider})",
        meta={"order_id": str(order.id), "external_id": external_id},
    )
    order.status = "paid"
    order.amount_minor = amount_minor
    order.external_id = external_id
    order.paid_at = datetime.now(timezone.utc)
    await session.commit()
    return {"status": "paid", "amount_minor": amount_minor, "balance_minor": new_balance}


# ----------------------------------------------------------------- админ: обнуление балансов

async def reset_balances(session: AsyncSession, keep_usernames: set[str]) -> dict[str, Any]:
    """Списывает весь TON-баланс у всех, кроме указанных админов. Каждое списание — проводка в журнале."""
    from app.core.money import gram_to_minor
    from app.models.ledger import Account

    rows = (
        await session.execute(
            select(Account.user_id, User.username)
            .join(User, User.id == Account.user_id)
            .where(Account.balance > 0)
        )
    ).all()
    users = 0
    total = 0
    for user_id, username in rows:
        if (username or "").lower().lstrip("@") in keep_usernames:
            continue
        account = (
            await session.execute(select(Account).where(Account.user_id == user_id).with_for_update())
        ).scalar_one()
        minor = gram_to_minor(account.balance)
        if minor <= 0:
            continue
        await post_ledger(
            session, user_id, type="admin_reset", direction="debit", minor=minor,
            description="Обнуление баланса администратором",
        )
        users += 1
        total += minor
    await session.commit()
    return {"ok": True, "users": users, "total_minor": total}
