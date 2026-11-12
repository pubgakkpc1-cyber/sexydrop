"""Приветствие @SexyDropBot на сервере: баннер + HTML-подпись с премиум-эмодзи нашего пака.

Серверный аналог scripts/bot_welcome.py: бот отвечает на /start (и на любое сообщение) через
вебхук Telegram, без отдельного локального поллера. Анимированные премиум-эмодзи
из официального набора Telegram (RestrictedEmoji) и TON Emoji; соответствие имя → custom_emoji_id
лежит в app/assets/bot_emoji_ids.json (чужие эмодзи работают, пока у владельца бота есть Premium). Если Telegram не принял премиум-эмодзи, уходит обычная версия.
"""

from __future__ import annotations

import hashlib
import html
import json
import logging
from pathlib import Path
from typing import Any

import httpx

from app.core.config import get_settings

log = logging.getLogger("sexydrop.bot")

CHANNEL_URL = "https://t.me/SexyDrop_official"
SUPPORT_URL = "https://t.me/SexyDropOwner"
# Кнопка меню чата (слева от поля ввода): Telegram разрешает тут только обычный текст и юникод-эмодзи,
# премиум-эмодзи в ней не поддерживаются.
MENU_BUTTON_TEXT = "Играть"

# Запасные юникод-эмодзи (показываются, если у клиента нет Premium или id не заданы)
FALLBACK = {
    "case": "🎁", "rocket": "🚀", "upgrade": "📈", "ton": "💎", "trophy": "🏆",
    "bolt": "⚡️", "nft": "🖼", "friends": "👥", "shield": "🔐", "play": "🎮",
    "channel": "📣", "support": "💬", "dot": "⭐️", "spark": "✨", "check": "✅", "free": "🆓",
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
        f"{e('spark')} <b>SEXY DROP — NFT-подарки Telegram</b>\n"
        "Кейсы, Ракета и апгрейды. Все выигрыши — в TON.\n\n"
        "<blockquote>"
        f"{e('case')} <b>Кейсы</b> — выбивай NFT-подарки\n"
        f"{e('rocket')} <b>Ракета</b> — лови иксы и забирай до взрыва\n"
        f"{e('upgrade')} <b>Апгрейд</b> — меняй подарок на более ценный\n"
        f"{e('trophy')} <b>Рейтинг</b> — соревнуйся с игроками\n"
        f"{e('friends')} <b>Друзья</b> — 2 ★ за каждого, кто откроет фри-кейс"
        "</blockquote>\n\n"
        f"{e('bolt')} <b>Авто-выдача</b> — NFT приходят прямо на твой аккаунт\n"
        f"{e('shield')} <b>Прозрачно</b> — баланс, ставки и вывод в TON\n\n"
        f"{e('free')} <b>Первый кейс — бесплатно!</b>\n"
        f"{e('play')} Жми «Играть» и забирай свой дроп"
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
            [btn("Играть в SEXY DROP", "play", "danger", web_app={"url": app_url})],
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


async def notify_admins_new_user(
    chat_ids: list[int],
    *,
    telegram_id: int,
    username: str | None,
    first_name: str | None,
    last_name: str | None,
    total_users: int,
    referrer: str | None = None,
) -> None:
    """Сообщение админам в бота о новом игроке. Ошибки только логируются."""
    if not chat_ids or not get_settings().bot_token:
        return
    name = html.escape(" ".join(p for p in (first_name, last_name) if p) or "—")
    lines = [
        "🆕 <b>Новый пользователь</b>",
        f"Имя: {name}",
        f"Username: {'@' + html.escape(username) if username else '—'}",
        f"ID: <code>{telegram_id}</code>",
    ]
    if referrer:
        lines.append(f"Пригласил: {html.escape(referrer)}")
    lines.append(f"Всего игроков: {total_users}")
    text = "\n".join(lines)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for cid in chat_ids:
                res = await client.post(
                    f"{_api_url()}/sendMessage",
                    json={"chat_id": cid, "text": text, "parse_mode": "HTML"},
                )
                if not res.json().get("ok"):
                    log.warning("admin notify to %s failed: %s", cid, res.text[:200])
    except Exception as exc:  # noqa: BLE001
        log.warning("admin notify failed: %s", exc)


async def notify_admins_text(session, text: str) -> None:
    """Короткое сообщение (HTML) всем админам в бота. Ошибки только логируются."""
    from sqlalchemy import func, select

    from app.api.odds import ADMIN_USERNAMES
    from app.models.user import User

    if not get_settings().bot_token:
        return
    try:
        ids = {int(x) for x in get_settings().admin_notify_chat_ids.split(",") if x.strip().lstrip("-").isdigit()}
        rows = await session.execute(select(User.telegram_id).where(func.lower(User.username).in_(ADMIN_USERNAMES)))
        ids.update(int(r[0]) for r in rows.all())
        async with httpx.AsyncClient(timeout=10.0) as client:
            for cid in sorted(ids):
                await client.post(f"{_api_url()}/sendMessage", json={"chat_id": cid, "text": text, "parse_mode": "HTML"})
    except Exception as exc:  # noqa: BLE001
        log.warning("admin text notify failed: %s", exc)


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
                        "text": MENU_BUTTON_TEXT,
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


async def _record_payment(payment: dict[str, Any]) -> None:
    """Оплата Stars: находит заказ по payload счёта и зачисляет TON на баланс игрока (один раз)."""
    payload = str(payment.get("invoice_payload", ""))
    total = payment.get("total_amount")
    charge = str(payment.get("telegram_payment_charge_id") or "")
    if not (payload.startswith("sd-stars-") and payment.get("currency") == "XTR" and isinstance(total, int) and charge):
        return
    from sqlalchemy import select

    from app.core.db import get_session_factory
    from app.models.economy import DepositOrder
    from app.services import account_service, deposit_service

    try:
        async with get_session_factory()() as session:
            order = (
                await session.execute(
                    select(DepositOrder).where(DepositOrder.provider == "stars", DepositOrder.secret == payload)
                )
            ).scalar_one_or_none()
            if order is None:
                log.warning("stars payment without order: %s (сверка найдёт игрока по Telegram ID)", payload)
                return
            await account_service.credit_deposit(session, order.id, deposit_service.stars_to_minor(total), charge)
        log.info("stars payment credited: %s stars", total)
    except Exception:  # noqa: BLE001
        log.exception("stars payment credit failed (сверка зачислит позже)")


async def _admin_broadcast(command: str, admin_id: int, chat_id: int) -> bool:
    """/rassylka — тест рассылки (добивка + напоминание о рефке) только админу; /rassylka_vsem — отправить всем (в течение 10 минут после теста)."""
    import asyncio
    import time as _t

    from app.core.db import get_session_factory
    from app.services import broadcast_service as bs
    from app.services import ref_share

    async with httpx.AsyncClient(timeout=20.0) as client:
        async def say(text: str) -> None:
            await client.post(f"{_api_url()}/sendMessage", json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})

        if command == "/rassylka":
            ok, err = await ref_share._send_photo_to(client, admin_id, f"{ref_share._base_url()}/brand/ref/boost-photo.jpg")
            if not ok:
                await say(f"Не получилось отправить тест: {err}")
                return True
            ref_share.arm_broadcast(admin_id)
            await say(
                "Так сообщение увидят игроки (ссылки у каждого свои). Если всё хорошо, "
                "в течение 10 минут отправьте /rassylka_vsem — оно уйдёт <b>всем игрокам</b>."
            )
            return True
        if not ref_share.is_broadcast_armed(admin_id):
            await say("Сначала отправьте /rassylka, проверьте тест, и затем в течение 10 минут /rassylka_vsem.")
            return True
        if bs.is_running():
            await say("Предыдущая рассылка ещё идёт.")
            return True
        async with get_session_factory()() as session:
            ids = await bs.audience_ids(session, "all")
        ref_share._armed.pop(admin_id, None)
        bs._state = {"state": "running", "audience": "all", "total": len(ids), "sent": 0, "failed": 0, "started": int(_t.time())}
        bs._task = asyncio.get_running_loop().create_task(ref_share.run_boost_broadcast(ids, bs._state))
        await say(f"Рассылка запущена: {len(ids)} получателей. Ход — в админке, раздел «Рассылка».")
        return True


async def _admin_command(message: dict[str, Any], chat_id: int) -> bool:
    """Команды админа в личке бота. /gifs — прислать все реферальные гифки."""
    text = str(message.get("text") or "").strip()
    command = text.split()[0].split("@")[0].lower() if text.startswith("/") else ""
    if command not in ("/gifs", "/post", "/rassylka", "/rassylka_vsem", "/opros"):
        return False
    from app.api.odds import ADMIN_USERNAMES
    from app.services import ref_share

    sender = message.get("from") or {}
    if str(sender.get("username") or "").lower().lstrip("@") not in ADMIN_USERNAMES:
        return False  # не админ — обычное приветствие
    if command in ("/rassylka", "/rassylka_vsem"):
        return await _admin_broadcast(command, int(sender.get("id") or chat_id), chat_id)
    if command == "/opros":
        await ref_share.send_clicker_poll(chat_id)
        return True
    if command == "/klikalka":
        await ref_share.send_clicker_launch(chat_id)
        return True
    if command == "/post":
        await ref_share.send_task_post(chat_id, int(sender.get("id") or chat_id))
        await ref_share.send_boost_post(chat_id, int(sender.get("id") or chat_id))
    else:
        await ref_share.send_previews(chat_id, int(sender.get("id") or chat_id))
    return True


async def _delete_service_message(chat_id: Any, message_id: Any) -> bool:
    """Удаляет сообщение о входе/выходе участника в чате SEXY DROP (бот — админ с правом удаления)."""
    settings = get_settings()
    if not isinstance(chat_id, int) or not isinstance(message_id, int) or not settings.bot_token:
        return False
    if str(chat_id) != (settings.ref_chat_id or "").strip():
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(f"{_api_url()}/deleteMessage", json={"chat_id": chat_id, "message_id": message_id})
            ok = bool(res.json().get("ok"))
    except Exception as exc:  # noqa: BLE001
        log.warning("deleteMessage failed: %s", exc)
        return False
    if not ok:
        log.warning("deleteMessage refused in chat %s", chat_id)
    return ok


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
        await _record_payment(payment)
        return True
    chat = message.get("chat") or {}
    if chat.get("type") not in (None, "private"):
        # в чате SEXY DROP бот убирает служебные «вступил / покинул группу»
        if message.get("new_chat_members") or message.get("left_chat_member"):
            return await _delete_service_message(chat.get("id"), message.get("message_id"))
        return False
    chat_id = chat.get("id")
    if not isinstance(chat_id, int):
        return False
    if await _admin_command(message, chat_id):
        return True
    from app.services import maintenance

    if await maintenance.is_on():
        from app.api.odds import ADMIN_USERNAMES

        if str((message.get("from") or {}).get("username") or "").lower().lstrip("@") not in ADMIN_USERNAMES:
            await maintenance.send_notice(chat_id)  # идут технические работы: вместо приветствия — объяснение
            return True
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
