"""Общие примитивы серверной экономики: ошибки, ГСЧ, проводки по балансу, идемпотентность раундов."""

from __future__ import annotations

import secrets
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import GRAM_QUANT, gram_to_minor, minor_to_gram
from app.models.economy import NftItem, PlayRound, UserMeta
from app.models.ledger import Account, Transaction

MAX_BET_MINOR = 1_000_000  # 1000 TON, как на клиенте
GAME_RTP_PCT = 98

_rng = secrets.SystemRandom()


class GameError(Exception):
    """Отказ операции: понятный код для клиента и HTTP-статус."""

    def __init__(self, code: str, status: int = 400, detail: str | None = None) -> None:
        super().__init__(detail or code)
        self.code = code
        self.status = status
        self.detail = detail or code


def randrange(n: int) -> int:
    """Равномерное целое в [0, n) из CSPRNG ОС."""
    return _rng.randrange(n)


def pick_weighted(entries: list[tuple[str, int]]) -> str:
    total = sum(w for _, w in entries)
    if total <= 0:
        raise GameError("case_empty", 500)
    roll = randrange(total)
    acc = 0
    for item, weight in entries:
        acc += weight
        if roll < acc:
            return item
    return entries[-1][0]


async def ensure_account(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Создаёт счёт и мета-запись игрока (идемпотентно); вызывать в начале запроса."""
    if (await session.execute(select(Account.id).where(Account.user_id == user_id))).first() is None:
        try:
            async with session.begin_nested():
                session.add(Account(user_id=user_id, balance=Decimal("0.000")))
        except IntegrityError:
            pass
    if (await session.execute(select(UserMeta.user_id).where(UserMeta.user_id == user_id))).first() is None:
        try:
            async with session.begin_nested():
                session.add(UserMeta(user_id=user_id, stars=0, quests_claimed={}, free_state={}, is_premium=False))
        except IntegrityError:
            pass
    await session.flush()


async def balance_minor(session: AsyncSession, user_id: uuid.UUID) -> int:
    row = (await session.execute(select(Account.balance).where(Account.user_id == user_id))).scalar_one_or_none()
    return gram_to_minor(row) if row is not None else 0


async def post_ledger(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    type: str,
    direction: str,
    minor: int,
    key: str | None = None,
    description: str | None = None,
    meta: dict[str, Any] | None = None,
) -> int:
    """Проводка по балансу без коммита (коммитит вызывающий). Возвращает баланс после операции в minor.

    Баланс блокируется FOR UPDATE; списание больше остатка → GameError('insufficient_funds', 402).
    """
    if minor < 0:
        raise ValueError("negative amount")
    account = (
        await session.execute(select(Account).where(Account.user_id == user_id).with_for_update())
    ).scalar_one_or_none()
    if account is None:
        await ensure_account(session, user_id)
        account = (
            await session.execute(select(Account).where(Account.user_id == user_id).with_for_update())
        ).scalar_one()
    amount = minor_to_gram(minor)
    if direction == "debit":
        if account.balance < amount:
            raise GameError("insufficient_funds", 402, "Недостаточно средств")
        account.balance = (account.balance - amount).quantize(GRAM_QUANT)
    else:
        account.balance = (account.balance + amount).quantize(GRAM_QUANT)
    session.add(
        Transaction(
            account_id=account.id,
            user_id=user_id,
            client_request_id=key,
            type=type,
            direction=direction,
            amount=amount,
            balance_after=account.balance,
            description=description,
            metadata_json=meta,
        )
    )
    await session.flush()
    return gram_to_minor(account.balance)


async def find_round(session: AsyncSession, user_id: uuid.UUID, game: str, request_id: str) -> PlayRound | None:
    return (
        await session.execute(
            select(PlayRound).where(
                PlayRound.user_id == user_id, PlayRound.game == game, PlayRound.request_id == request_id
            )
        )
    ).scalar_one_or_none()


async def new_round(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    game: str,
    request_id: str,
    case_id: str | None = None,
    bet_minor: int = 0,
    status: str = "done",
    state: dict[str, Any] | None = None,
) -> PlayRound:
    """Создаёт раунд. Дубликат (user, game, request_id) → IntegrityError, которую ловит `replayable`."""
    row = PlayRound(
        id=uuid.uuid4(),
        user_id=user_id,
        game=game,
        request_id=request_id,
        case_id=case_id,
        bet_minor=bet_minor,
        status=status,
        state=state,
    )
    session.add(row)
    await session.flush()
    return row


async def add_item(
    session: AsyncSession, user_id: uuid.UUID, gift_id: str, price_minor: int, source: str, *, status: str = "available",
    meta: dict[str, Any] | None = None,
) -> NftItem:
    item = NftItem(
        id=uuid.uuid4(), user_id=user_id, gift_id=gift_id, price_minor=price_minor, source=source, status=status, meta=meta
    )
    session.add(item)
    await session.flush()
    return item


async def lock_item(session: AsyncSession, user_id: uuid.UUID, item_id: str) -> NftItem:
    try:
        uid = uuid.UUID(str(item_id))
    except ValueError as exc:
        raise GameError("unknown_item", 404) from exc
    item = (
        await session.execute(
            select(NftItem).where(NftItem.id == uid, NftItem.user_id == user_id).with_for_update()
        )
    ).scalar_one_or_none()
    if item is None:
        raise GameError("unknown_item", 404)
    return item


def item_dict(item: NftItem) -> dict[str, Any]:
    return {
        "uid": str(item.id),
        "gift_id": item.gift_id,
        "price_minor": item.price_minor,
        "source": item.source,
        "status": item.status,
        "acquired_at": int(item.created_at.timestamp() * 1000) if item.created_at else 0,
        "meta": item.meta or {},
    }
