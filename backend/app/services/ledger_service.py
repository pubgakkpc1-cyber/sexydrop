from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal, Optional
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import GRAM_QUANT, gram_to_minor
from app.models.ledger import Account, Transaction


class InsufficientFundsError(Exception):
    """Raised when an account cannot satisfy a debit operation."""


async def get_or_create_account(session: AsyncSession, user_id: uuid.UUID) -> Account:
    stmt = select(Account).where(Account.user_id == user_id)
    result = await session.execute(stmt)
    account = result.scalar_one_or_none()
    if account is None:
        try:
            account = Account(user_id=user_id, balance=Decimal("0.000"))
            session.add(account)
            await session.commit()
            await session.refresh(account)
        except IntegrityError:
            await session.rollback()
            result = await session.execute(stmt)
            account = result.scalar_one()
    return account


async def get_user_balance(session: AsyncSession, user_id: uuid.UUID) -> tuple[Decimal, int]:
    """Return current balance as (Decimal GRAM, int minor)."""
    account = await get_or_create_account(session, user_id)
    minor = gram_to_minor(account.balance)
    return account.balance, minor


async def execute_balance_operation(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: str,
    direction: Literal["credit", "debit"],
    amount_gram: Decimal,
    client_request_id: Optional[str] = None,
    description: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> tuple[Transaction, bool]:
    """Execute an atomic balance mutation with row-level locking and idempotency.

    Returns:
        (Transaction, is_new: bool)
        If client_request_id was already processed, returns (existing_tx, False).
    """
    if amount_gram < Decimal("0.000"):
        raise ValueError("Amount cannot be negative")

    quantized_amount = amount_gram.quantize(GRAM_QUANT)

    # 1. Fast idempotency check before locking
    if client_request_id:
        stmt_existing = select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.client_request_id == client_request_id,
        )
        res_existing = await session.execute(stmt_existing)
        existing_tx = res_existing.scalar_one_or_none()
        if existing_tx is not None:
            return existing_tx, False

    # 2. Lock account row with FOR UPDATE (create account if it does not exist yet)
    stmt_lock = (
        select(Account)
        .where(Account.user_id == user_id)
        .with_for_update()
    )
    res_lock = await session.execute(stmt_lock)
    account = res_lock.scalar_one_or_none()
    if account is None:
        try:
            account = Account(user_id=user_id, balance=Decimal("0.000"))
            session.add(account)
            await session.flush()
        except IntegrityError:
            await session.rollback()
            res_lock = await session.execute(stmt_lock)
            account = res_lock.scalar_one()

    # Double check idempotency under row lock
    if client_request_id:
        stmt_existing = select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.client_request_id == client_request_id,
        )
        res_existing = await session.execute(stmt_existing)
        existing_tx = res_existing.scalar_one_or_none()
        if existing_tx is not None:
            return existing_tx, False

    # 3. Enforce balance constraint for debits
    if direction == "debit":
        if account.balance < quantized_amount:
            raise InsufficientFundsError(
                f"Insufficient funds: available {account.balance} GRAM, requested {quantized_amount} GRAM"
            )
        new_balance = account.balance - quantized_amount
    else:
        new_balance = account.balance + quantized_amount

    account.balance = new_balance

    # 4. Insert transaction ledger entry
    tx = Transaction(
        account_id=account.id,
        user_id=user_id,
        client_request_id=client_request_id,
        type=type,
        direction=direction,
        amount=quantized_amount,
        balance_after=new_balance,
        description=description,
        metadata_json=metadata,
    )
    session.add(tx)

    try:
        await session.commit()
    except IntegrityError as exc:
        if client_request_id and "ix_transactions_user_request_id" in str(exc):
            await session.rollback()
            stmt_existing = select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.client_request_id == client_request_id,
            )
            res_existing = await session.execute(stmt_existing)
            existing_tx = res_existing.scalar_one_or_none()
            if existing_tx is not None:
                return existing_tx, False
        raise

    await session.refresh(tx)
    return tx, True
