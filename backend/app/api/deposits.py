from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services import deposit_service as svc

router = APIRouter(prefix="/api/deposits", tags=["deposits"])

_SECRET = Field(min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class InvoiceRequest(BaseModel):
    amount_minor: int = Field(ge=1)
    secret: str = _SECRET


def _raise(exc: svc.DepositError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.detail)


@router.get("/config")
async def deposit_config() -> dict[str, Any]:
    return svc.config()


@router.post("/cryptobot/invoice")
async def cryptobot_invoice(payload: InvoiceRequest) -> dict[str, Any]:
    try:
        return await svc.create_cryptobot_invoice(payload.amount_minor, payload.secret)
    except svc.DepositError as exc:
        raise _raise(exc) from exc


@router.get("/cryptobot/invoice/{invoice_id}")
async def cryptobot_status(
    invoice_id: int, secret: str = Query(min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
) -> dict[str, Any]:
    try:
        return await svc.cryptobot_invoice_status(invoice_id, secret)
    except svc.DepositError as exc:
        raise _raise(exc) from exc


@router.get("/ton/comment")
async def ton_comment(
    secret: str = Query(min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$"),
) -> dict[str, str]:
    return {"comment": svc.ton_comment(secret)}


@router.get("/ton/status")
async def ton_status(
    secret: str = Query(min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$"),
) -> dict[str, Any]:
    try:
        return await svc.ton_payment_status(secret)
    except svc.DepositError as exc:
        raise _raise(exc) from exc
