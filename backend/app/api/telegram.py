import hmac
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.services.telegram_bot import handle_update, webhook_secret

router = APIRouter(prefix="/api", tags=["telegram"])


@router.post("/telegram/webhook/{secret}")
async def telegram_webhook(secret: str, request: Request) -> dict[str, bool]:
    """Вебхук бота: Telegram шлёт сюда апдейты, бот отвечает приветствием."""
    expected = webhook_secret()
    if not expected or not hmac.compare_digest(secret, expected):
        raise HTTPException(status_code=404, detail="Not found")
    try:
        update: Any = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Bad update") from exc
    if not isinstance(update, dict):
        raise HTTPException(status_code=400, detail="Bad update")
    handled = await handle_update(update)
    return {"ok": True, "handled": handled}
