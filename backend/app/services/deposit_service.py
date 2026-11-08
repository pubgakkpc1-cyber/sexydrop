"""Реальные пополнения: @CryptoBot (Crypto Pay API) и прямые переводы TON с кошельков (TON Connect).

Баланс игрока ведёт сервер: он подтверждает оплату у провайдера и сам зачисляет её (account_service.credit_deposit):
- CryptoBot: создаёт счёт (payload = секрет клиента) и отдаёт его статус только с этим секретом;
- TON: клиент шлёт перевод на адрес проекта с комментарием, производным от секрета; сервер ищет
  входящий перевод с таким комментарием. Сам комментарий публичен в блокчейне, секрет — нет,
  поэтому чужую оплату присвоить нельзя.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from decimal import ROUND_DOWN, Decimal
from typing import Any

import httpx

from app.core.config import get_settings

log = logging.getLogger("sexydrop.deposits")

MINOR_PER_TON = 1000
MIN_DEPOSIT_MINOR = 100  # 0.1 TON
MAX_DEPOSIT_MINOR = 1_000_000  # 1000 TON
NANO_PER_MINOR = 1_000_000


class DepositError(Exception):
    def __init__(self, status: int, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail


def minor_to_ton_str(minor: int) -> str:
    return f"{Decimal(minor) / MINOR_PER_TON:.3f}"


def ton_to_minor(value: str | float | Decimal) -> int:
    return int((Decimal(str(value)) * MINOR_PER_TON).to_integral_value(rounding=ROUND_DOWN))


def ton_comment(secret: str) -> str:
    """Комментарий перевода: короткий хэш секрета (секрет в блокчейн не попадает)."""
    return "sd-" + hashlib.sha256(f"sexydrop-ton:{secret}".encode()).hexdigest()[:20]


def config() -> dict[str, Any]:
    s = get_settings()
    return {
        "ton_address": s.ton_deposit_address or None,
        "cryptobot": bool(s.cryptobot_token),
        "stars": bool(s.bot_token),
        "min_minor": MIN_DEPOSIT_MINOR,
        "max_minor": MAX_DEPOSIT_MINOR,
    }


def _check_amount(amount_minor: int) -> None:
    if not MIN_DEPOSIT_MINOR <= amount_minor <= MAX_DEPOSIT_MINOR:
        raise DepositError(400, "Сумма вне допустимых пределов")


# ---------------------------------------------------------------- CryptoBot ----


async def _crypto_call(method: str, params: dict[str, Any]) -> dict[str, Any]:
    s = get_settings()
    if not s.cryptobot_token:
        raise DepositError(503, "CryptoBot не настроен")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(
                f"{s.cryptobot_api_url.rstrip('/')}/{method}",
                params=params,
                headers={"Crypto-Pay-API-Token": s.cryptobot_token},
            )
        body = res.json()
    except Exception as exc:  # noqa: BLE001
        log.warning("cryptobot %s failed: %s", method, exc)
        raise DepositError(502, "CryptoBot недоступен") from exc
    if not body.get("ok"):
        log.warning("cryptobot %s error: %s", method, body.get("error"))
        raise DepositError(502, "CryptoBot отклонил запрос")
    return body["result"]


async def create_cryptobot_invoice(amount_minor: int, secret: str) -> dict[str, Any]:
    _check_amount(amount_minor)
    result = await _crypto_call(
        "createInvoice",
        {
            "currency_type": "crypto",
            "asset": "TON",
            "amount": minor_to_ton_str(amount_minor),
            "description": "Пополнение баланса SEXY DROP",
            "payload": secret,
            "expires_in": 3600,
            "allow_comments": "false",
            "allow_anonymous": "false",
        },
    )
    return {
        "invoice_id": int(result["invoice_id"]),
        "pay_url": result.get("bot_invoice_url") or result.get("pay_url"),
        "mini_app_url": result.get("mini_app_invoice_url"),
    }


async def cryptobot_invoice_status(invoice_id: int, secret: str) -> dict[str, Any]:
    result = await _crypto_call("getInvoices", {"invoice_ids": str(invoice_id)})
    items = result.get("items") or []
    if not items:
        raise DepositError(404, "Счёт не найден")
    inv = items[0]
    if not hmac.compare_digest(str(inv.get("payload") or ""), secret):
        raise DepositError(404, "Счёт не найден")
    status = str(inv.get("status"))
    out: dict[str, Any] = {"status": status}
    if status == "paid":
        out["amount_minor"] = ton_to_minor(inv.get("amount", "0"))
    return out


# --------------------------------------------------------------------- TON ----


async def ton_payment_status(secret: str) -> dict[str, Any]:
    s = get_settings()
    if not s.ton_deposit_address:
        raise DepositError(503, "Приём TON не настроен")
    comment = ton_comment(secret)
    headers = {"X-API-Key": s.toncenter_api_key} if s.toncenter_api_key else {}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(
                f"{s.toncenter_api_url.rstrip('/')}/transactions",
                params={"account": s.ton_deposit_address, "limit": 100, "sort": "desc"},
                headers=headers,
            )
        body = res.json()
    except Exception as exc:  # noqa: BLE001
        log.warning("toncenter failed: %s", exc)
        raise DepositError(502, "Не удалось проверить перевод") from exc

    for tx in body.get("transactions") or []:
        msg = tx.get("in_msg") or {}
        decoded = (msg.get("message_content") or {}).get("decoded") or {}
        if decoded.get("comment") != comment:
            continue
        aborted = ((tx.get("description") or {}).get("aborted")) is True
        if aborted:
            continue
        try:
            nano = int(msg.get("value") or 0)
        except (TypeError, ValueError):
            continue
        minor = nano // NANO_PER_MINOR
        if minor >= MIN_DEPOSIT_MINOR:
            return {"status": "paid", "amount_minor": min(minor, MAX_DEPOSIT_MINOR)}
    return {"status": "pending"}


# ------------------------------------------------------------------- Stars ----

MINOR_PER_STAR = 10  # единый курс: 100 Stars = 1 TON
STARS_MIN = 10
STARS_MAX = 10_000

def stars_to_minor(stars: int) -> int:
    return stars * MINOR_PER_STAR


def stars_payload(secret: str) -> str:
    return "sd-stars-" + hashlib.sha256(f"sexydrop-stars:{secret}".encode()).hexdigest()[:24]


async def create_stars_invoice(stars: int, secret: str) -> dict[str, Any]:
    if not STARS_MIN <= stars <= STARS_MAX:
        raise DepositError(400, "Количество Stars вне допустимых пределов")
    s = get_settings()
    if not s.bot_token:
        raise DepositError(503, "Оплата Stars не настроена")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"https://api.telegram.org/bot{s.bot_token}/createInvoiceLink",
                json={
                    "title": "Пополнение SEXY DROP",
                    "description": f"{stars} Stars → {stars_to_minor(stars) / MINOR_PER_TON:.3f} TON на баланс",
                    "payload": stars_payload(secret),
                    "currency": "XTR",
                    "prices": [{"label": "Stars", "amount": stars}],
                },
            )
        body = res.json()
    except Exception as exc:  # noqa: BLE001
        log.warning("createInvoiceLink failed: %s", exc)
        raise DepositError(502, "Telegram недоступен") from exc
    if not body.get("ok"):
        log.warning("createInvoiceLink error: %s", body.get("description"))
        raise DepositError(502, "Telegram отклонил счёт")
    return {"invoice_url": body["result"]}
