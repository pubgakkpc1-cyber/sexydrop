import hmac
from typing import Any

import httpx

from fastapi import APIRouter, HTTPException, Request

from app.core.config import get_settings
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


@router.get("/telegram/status")
async def telegram_status() -> dict[str, Any]:
    """Диагностика бота без секретов: чей токен на сервере и куда смотрит вебхук."""
    token = get_settings().bot_token
    if not token:
        return {"token": False}
    out: dict[str, Any] = {"token": True}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            me = (await client.get(f"https://api.telegram.org/bot{token}/getMe")).json()
            info = (await client.get(f"https://api.telegram.org/bot{token}/getWebhookInfo")).json()
    except Exception as exc:  # noqa: BLE001
        return {"token": True, "error": type(exc).__name__}
    out["bot"] = (me.get("result") or {}).get("username") if me.get("ok") else me.get("description")
    res = info.get("result") or {}
    url = res.get("url") or ""
    out["webhook"] = url.rsplit("/", 1)[0] + "/***" if url else None
    out["pending"] = res.get("pending_update_count")
    out["last_error"] = res.get("last_error_message")
    out["allowed_updates"] = res.get("allowed_updates")
    from app.services import subscription_service

    out["admin_in_chats"] = {str(k): v for k, v in subscription_service.discovered_chats.items()}
    return out
