"""Приветствие @SexyDropBot на сервере: баннер + HTML-подпись с премиум-эмодзи нашего пака.

Серверный аналог scripts/bot_welcome.py: бот отвечает на /start (и на любое сообщение) через
вебхук Telegram, без отдельного локального поллера. Пак эмодзи:
https://t.me/addemoji/sexydrop_by_sexydropbot, соответствие имя → custom_emoji_id лежит в
app/assets/bot_emoji_ids.json. Если Telegram не принял премиум-эмодзи, уходит обычная версия.
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

import httpx

from app.core.config import get_settings

log = logging.getLogger("sexydrop.bot")

CHANNEL_URL = "https://t.me/SexyDrop_official"
SUPPORT_URL = "https://t.me/SexyDropOwner"

# Запасные юникод-эмодзи (показываются, если у клиента нет Premium или id не заданы)
FALLBACK = {
    "case": "🎁", "rocket": "🚀", "upgrade": "⬆️", "ton": "💎", "trophy": "🏆",
    "bolt": "⚡", "nft": "🖼", "friends": "👥", "shield": "🛡", "play": "▶️",
    "channel": "📣", "support": "🎧", "dot": "🔸", "spark": "✨", "check": "✅",
}

_APP_ROOT = Path(__file__).resolve().parents[1]  # backend/app
_BANNER_CANDIDATES = (
    Path("/app/dist/brand/bot-welcome.png"),  # Docker: собранный фронтенд
    _APP_ROOT.parents[1] / "dist" / "brand" / "bot-welcome.png",
    _APP_ROOT.parents[1] / "public" / "brand" / "bot-welcome.png",  # локальная разработка
)


def _load_emoji_ids() -> dict[str, str]:
    try:
        return json.loads((_APP_ROOT / "assets" / "bot_emoji_ids.json").read_text("utf-8"))
    except Exception:  # noqa: BLE001
        return {}


EMOJI_IDS: dict[str, str] = _load_emoji_ids()

_file_id_cache: dict[str, str] = {}


def banner_path() -> Path | None:
    for candidate in _BANNER_CANDIDATES:
        if candidate.is_file():
            return candidate
    return None


def em(name: str, premium: bool = True) -> str:
    """HTML-вставка эмодзи: премиум, если известен id, иначе обычное."""
    fb = FALLBACK[name]
    eid = EMOJI_IDS.get(name)
    if premium and eid:
        return f'<tg-emoji emoji-id="{eid}">{fb}</tg-emoji>'
    return fb


def build_caption(premium: bool = True) -> str:
    def e(n: str) -> str:
        return em(n, premium)

    return (
        f"{e('spark')} <b>Добро пожаловать в SEXY DROP!</b>\n"
        "NFT-подарки и игры в Telegram — всё в TON.\n\n"
        f"{e('rocket')} <b>Ракета</b> — лови иксы и забирай выигрыш до взрыва\n"
        f"{e('case')} <b>Кейсы</b> — открывай и выбивай NFT-подарки\n"
        f"{e('upgrade')} <b>Апгрейд</b> — меняй подарок на более ценный\n"
        f"{e('trophy')} <b>Рейтинг</b> — соревнуйся с другими игроками\n"
        f"{e('friends')} <b>Друзья</b> — приглашай и получай по 2 ★ за каждого, кто откроет фри-кейс\n\n"
        f"{e('bolt')} <b>Авто-выдача.</b> Выигранные NFT-подарки выдаёт менеджер автоматически — "
        "прямо на твой аккаунт Telegram.\n"
        f"{e('shield')} <b>Прозрачно.</b> Баланс, ставки и вывод — в TON, история игр всегда в профиле.\n\n"
        f"{e('play')} Жми «Играть» и забирай свой дроп!"
    )


def build_keyboard(app_url: str, premium: bool = True) -> dict[str, Any]:
    def btn(text: str, icon: str, style: str | None = None, **target: Any) -> dict[str, Any]:
        b: dict[str, Any] = {"text": text, **target}
        if premium and EMOJI_IDS.get(icon):
            b["icon_custom_emoji_id"] = EMOJI_IDS[icon]
        if premium and style:
            b["style"] = style
        return b

    return {
        "inline_keyboard": [
            [btn("Играть", "play", "danger", web_app={"url": app_url})],
            [
                btn("Канал", "channel", url=CHANNEL_URL),
                btn("Поддержка", "support", url=SUPPORT_URL),
            ],
        ]
    }


def webhook_secret() -> str:
    """Секрет в пути вебхука: из окружения или производный от токена бота (в код не попадает)."""
    settings = get_settings()
    if settings.telegram_webhook_secret:
        return settings.telegram_webhook_secret
    if not settings.bot_token:
        return ""
    return hashlib.sha256(f"sexydrop-webhook:{settings.bot_token}".encode()).hexdigest()[:32]


def _api_url() -> str:
    return f"https://api.telegram.org/bot{get_settings().bot_token}"


async def _send_once(client: httpx.AsyncClient, chat_id: int, premium: bool) -> dict[str, Any]:
    settings = get_settings()
    data = {
        "chat_id": chat_id,
        "caption": build_caption(premium),
        "parse_mode": "HTML",
        "reply_markup": json.dumps(build_keyboard(settings.app_url, premium), ensure_ascii=False),
    }
    cached = _file_id_cache.get("banner")
    if cached:
        res = await client.post(f"{_api_url()}/sendPhoto", data={**data, "photo": cached})
        return res.json()
    path = banner_path()
    if path is None:
        # нет баннера — отправляем текстом
        text_data = {
            "chat_id": chat_id,
            "text": data["caption"],
            "parse_mode": "HTML",
            "reply_markup": data["reply_markup"],
        }
        return (await client.post(f"{_api_url()}/sendMessage", data=text_data)).json()
    with path.open("rb") as fh:
        res = await client.post(
            f"{_api_url()}/sendPhoto",
            data=data,
            files={"photo": ("welcome.png", fh.read(), "image/png")},
        )
    body = res.json()
    if body.get("ok"):
        sizes = (body.get("result") or {}).get("photo") or []
        if sizes:
            _file_id_cache["banner"] = sizes[-1]["file_id"]
    return body


async def send_welcome(chat_id: int) -> dict[str, Any]:
    """Отправляет приветствие; при отказе Telegram от премиум-эмодзи шлёт обычную версию."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await _send_once(client, chat_id, premium=True)
        if not res.get("ok"):
            log.warning("welcome(premium) failed: %s", res.get("description"))
            res = await _send_once(client, chat_id, premium=False)
            if not res.get("ok"):
                log.warning("welcome(plain) failed: %s", res.get("description"))
        return res


async def _set_menu_button(chat_id: int) -> None:
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{_api_url()}/setChatMenuButton",
                json={
                    "chat_id": chat_id,
                    "menu_button": {
                        "type": "web_app",
                        "text": "SEXY DROP",
                        "web_app": {"url": settings.app_url},
                    },
                },
            )
    except Exception as exc:  # noqa: BLE001
        log.warning("setChatMenuButton failed: %s", exc)


def _remember_chat(update: dict[str, Any]) -> None:
    """Бот стал админом канала/группы: запоминаем id (нужен для проверки приватного канала)."""
    from app.services import subscription_service

    chat = update.get("chat") or {}
    status = (update.get("new_chat_member") or {}).get("status")
    cid = chat.get("id")
    if not isinstance(cid, int) or chat.get("type") not in ("channel", "supergroup"):
        return
    if status == "administrator":
        subscription_service.discovered_chats[cid] = str(chat.get("title") or cid)
        log.info("bot is admin in chat %s (%s)", cid, chat.get("title"))
    else:
        subscription_service.discovered_chats.pop(cid, None)


async def _answer_pre_checkout(query: dict[str, Any]) -> bool:
    """Подтверждает оплату Stars только для наших счетов (payload «sd-stars-…», валюта XTR)."""
    ok = str(query.get("invoice_payload", "")).startswith("sd-stars-") and query.get("currency") == "XTR"
    body: dict[str, Any] = {"pre_checkout_query_id": query.get("id"), "ok": ok}
    if not ok:
        body["error_message"] = "Неизвестный счёт"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(f"{_api_url()}/answerPreCheckoutQuery", json=body)
    except Exception as exc:  # noqa: BLE001
        log.warning("answerPreCheckoutQuery failed: %s", exc)
    return ok


def _record_payment(payment: dict[str, Any]) -> None:
    payload = str(payment.get("invoice_payload", ""))
    total = payment.get("total_amount")
    if payload.startswith("sd-stars-") and payment.get("currency") == "XTR" and isinstance(total, int):
        from app.services import deposit_service

        deposit_service.paid_stars[payload] = total
        log.info("stars payment recorded: %s stars", total)


async def handle_update(update: dict[str, Any]) -> bool:
    """Обработка входящего апдейта: на любое личное сообщение (в т.ч. /start) — приветствие."""
    member = update.get("my_chat_member")
    if isinstance(member, dict):
        _remember_chat(member)
        return True
    pre = update.get("pre_checkout_query")
    if isinstance(pre, dict):
        return await _answer_pre_checkout(pre)
    message = update.get("message")
    if not isinstance(message, dict):
        return False
    payment = message.get("successful_payment")
    if isinstance(payment, dict):
        _record_payment(payment)
        return True
    chat = message.get("chat") or {}
    if chat.get("type") not in (None, "private"):
        return False
    chat_id = chat.get("id")
    if not isinstance(chat_id, int):
        return False
    await _set_menu_button(chat_id)
    await send_welcome(chat_id)
    return True


async def register_webhook() -> bool:
    """Регистрирует вебхук {PUBLIC_BASE_URL}/api/telegram/webhook/{секрет}. Без URL или токена — пропуск."""
    settings = get_settings()
    secret = webhook_secret()
    # PUBLIC_BASE_URL не обязателен: по умолчанию вебхук ставится на адрес мини-аппа (APP_URL)
    base = settings.public_base_url or settings.app_url
    if not settings.bot_token or not base or not secret:
        log.info("telegram webhook: BOT_TOKEN или адрес сервиса не заданы — пропуск")
        return False
    url = f"{base.rstrip('/')}/api/telegram/webhook/{secret}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"{_api_url()}/setWebhook",
                json={"url": url, "allowed_updates": ["message", "pre_checkout_query", "my_chat_member"], "drop_pending_updates": False},
            )
        body = res.json()
        ok = bool(body.get("ok"))
        if ok:
            log.info("telegram webhook registered: %s", url.rsplit("/", 1)[0] + "/***")
        else:
            log.warning("telegram webhook rejected: %s", body.get("description"))
        return ok
    except Exception as exc:  # noqa: BLE001
        log.warning("telegram webhook registration failed: %s", exc)
        return False
