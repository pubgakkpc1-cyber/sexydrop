"""Пополнения: заказ привязан к игроку, зачисление на баланс — на сервере и ровно один раз."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_session
from app.models.economy import DepositOrder
from app.models.user import User
from app.services import account_service as acct
from app.services import deposit_service as svc
from app.services.economy_core import balance_minor

router = APIRouter(prefix="/api/deposits", tags=["deposits"])

_SECRET = Field(min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
Session = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]
SecretQuery = Annotated[str, Query(min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")]


class InvoiceRequest(BaseModel):
    amount_minor: int = Field(ge=1)
    secret: str = _SECRET


class StarsRequest(BaseModel):
    stars: int = Field(ge=1)
    secret: str = _SECRET


def _raise(exc: svc.DepositError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.detail)


async def _order(session: AsyncSession, user: User, provider: str, secret: str) -> DepositOrder:
    order = (
        await session.execute(
            select(DepositOrder).where(DepositOrder.provider == provider, DepositOrder.secret == secret)
        )
    ).scalar_one_or_none()
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    return order


async def _paid(session: AsyncSession, order: DepositOrder, amount: int, external: str | None) -> dict[str, Any]:
    res = await acct.credit_deposit(session, order.id, amount, external)
    return {"status": "paid", "amount_minor": res["amount_minor"], "balance_minor": res["balance_minor"]}


@router.get("/config")
async def deposit_config() -> dict[str, Any]:
    return svc.config()


@router.post("/cryptobot/invoice")
async def cryptobot_invoice(payload: InvoiceRequest, user: CurrentUser, session: Session) -> dict[str, Any]:
    try:
        invoice = await svc.create_cryptobot_invoice(payload.amount_minor, payload.secret)
    except svc.DepositError as exc:
        raise _raise(exc) from exc
    await acct.create_deposit_order(session, user.id, "cryptobot", payload.secret, payload.amount_minor)
    return invoice


@router.get("/cryptobot/invoice/{invoice_id}")
async def cryptobot_status(invoice_id: int, secret: SecretQuery, user: CurrentUser, session: Session) -> dict[str, Any]:
    order = await _order(session, user, "cryptobot", secret)
    if order.status == "paid":
        return await _paid(session, order, order.amount_minor, order.external_id)
    try:
        res = await svc.cryptobot_invoice_status(invoice_id, secret)
    except svc.DepositError as exc:
        raise _raise(exc) from exc
    if res.get("status") == "paid":
        # платим по факту оплаты, но не больше суммы заказа
        amount = min(int(res.get("amount_minor", 0)), order.amount_minor)
        return await _paid(session, order, amount, f"cb:{invoice_id}")
    return {"status": res.get("status", "pending")}


@router.get("/ton/comment")
async def ton_comment(secret: SecretQuery, user: CurrentUser, session: Session) -> dict[str, str]:
    await acct.create_deposit_order(session, user.id, "ton", secret, 0)
    return {"comment": svc.ton_comment(secret)}


@router.get("/ton/status")
async def ton_status(secret: SecretQuery, user: CurrentUser, session: Session) -> dict[str, Any]:
    order = await _order(session, user, "ton", secret)
    if order.status == "paid":
        return await _paid(session, order, order.amount_minor, order.external_id)
    try:
        res = await svc.ton_payment_status(secret)
    except svc.DepositError as exc:
        raise _raise(exc) from exc
    if res.get("status") == "paid":
        return await _paid(session, order, int(res["amount_minor"]), svc.ton_comment(secret))
    return {"status": "pending"}


@router.post("/stars/invoice")
async def stars_invoice(payload: StarsRequest, user: CurrentUser, session: Session) -> dict[str, Any]:
    try:
        invoice = await svc.create_stars_invoice(payload.stars, payload.secret)
    except svc.DepositError as exc:
        raise _raise(exc) from exc
    await acct.create_deposit_order(
        session, user.id, "stars", svc.stars_payload(payload.secret), svc.stars_to_minor(payload.stars)
    )
    return invoice


@router.get("/stars/status")
async def stars_status(secret: SecretQuery, user: CurrentUser, session: Session) -> dict[str, Any]:
    order = await _order(session, user, "stars", svc.stars_payload(secret))
    if order.status == "paid":
        return {"status": "paid", "amount_minor": order.amount_minor, "balance_minor": await balance_minor(session, user.id)}
    return {"status": "pending"}
