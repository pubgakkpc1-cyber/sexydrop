"""Реферальные приглашения: «Поделиться» из мини-аппа отправляет анимацию с подписью и текстовой ссылкой.

Для каждого места, где есть реферальная ссылка, своя гифка (public/brand/ref/<kind>.gif):
  invite   — экран «Пригласить»;
  unlock   — окно задания бесплатного кейса (NFT под замком);
  roulette — подарок под замком в инвентаре.

Мини-апп просит сервер подготовить сообщение (Bot API savePreparedInlineMessage) и открывает
окно выбора чата через WebApp.shareMessage. Админу гифки присылаются в бота: один раз после
деплоя новой версии и по команде /gifs.
"""

from __future__ import annotations

import asyncio
import html
import json
import logging
from pathlib import Path
from typing import Any

import httpx

from app.core.config import get_settings

log = logging.getLogger("sexydrop.refshare")

BOT_USERNAME = "sexydropbot"
PHOTO_W, PHOTO_H = 1280, 720  # баннеры public/brand/ref/<kind>-photo.jpg
# смена версии — админу снова придут все гифки после деплоя
PREVIEW_VERSION = "2026-11-08-photo-v1"

KINDS: dict[str, dict[str, str]] = {
    "invite": {
        "place": "Экран «Пригласить друзей»",
        "title": "🎁 <b>Бесплатные NFT-подарки в SEXY DROP</b>",
        "body": "Сундук FREE 24 — каждый день бесплатно, а первый кейс с NFT тебе тоже ничего не стоит.",
        "link": "Тык — забрать бесплатный кейс",
        "button": "🎁 Забрать бесплатный кейс",
    },
    "unlock": {
        "place": "Окно задания бесплатного кейса (NFT под замком)",
        "title": "🔓 <b>Друг ждёт тебя в SEXY DROP</b>",
        "body": "Зайди по ссылке и прокрути бесплатный кейс — он твой. Вступи в чат, и вы оба в плюсе.",
        "link": "Тык — крутить бесплатно",
        "button": "🔓 Крутить бесплатно",
    },
    "roulette": {
        "place": "Подарок под замком в инвентаре",
        "title": "🎰 <b>Крути рулетку NFT в SEXY DROP</b>",
        "body": "Редкие подарки падают каждый день. Первый кейс — бесплатно, FREE 24 — раз в сутки.",
        "link": "Тык — попробовать",
        "button": "🎰 Крутить рулетку",
    },
}

_APP_ROOT = Path(__file__).resolve().parents[1]  # backend/app
_GIF_DIRS = (
    Path("/app/dist/brand/ref"),  # Docker: собранный фронтенд
    _APP_ROOT.parents[1] / "dist" / "brand" / "ref",
    _APP_ROOT.parents[1] / "public" / "brand" / "ref",  # локальная разработка
)


def ref_link(telegram_id: int) -> str:
    return f"https://t.me/{BOT_USERNAME}?startapp=ref-{int(telegram_id)}"


def caption(kind: str, telegram_id: int) -> str:
    """HTML-подпись под гифкой: текст и кликабельная текстовая ссылка «Тык — …»."""
    k = KINDS[kind]
    link = html.escape(ref_link(telegram_id), quote=True)
    return f'{k["title"]}\n\n{k["body"]}\n\n👉 <a href="{link}">{k["link"]}</a>'


def keyboard(kind: str, telegram_id: int) -> dict[str, Any]:
    return {"inline_keyboard": [[{"text": KINDS[kind]["button"], "url": ref_link(telegram_id)}]]}


def _base_url() -> str:
    s = get_settings()
    return (s.public_base_url or s.app_url).rstrip("/")


def photo_path(kind: str) -> Path | None:
    for d in _GIF_DIRS:
        p = d / f"{kind}-photo.jpg"
        if p.is_file():
            return p
    return None


def _api() -> str:
    return f"https://api.telegram.org/bot{get_settings().bot_token}"


async def prepare_share(telegram_id: int, kind: str) -> str | None:
    """Готовит сообщение-гифку для WebApp.shareMessage. Возвращает id или None (Telegram отказал)."""
    if kind not in KINDS or not get_settings().bot_token:
        return None
    base = _base_url()
    result = {
        "type": "photo",
        "id": f"{kind}-{telegram_id}"[:64],
        "photo_url": f"{base}/brand/ref/{kind}-photo.jpg",
        "thumbnail_url": f"{base}/brand/ref/{kind}-photo.jpg",
        "photo_width": PHOTO_W,
        "photo_height": PHOTO_H,
        "caption": caption(kind, telegram_id),
        "parse_mode": "HTML",
        "reply_markup": keyboard(kind, telegram_id),
    }
    payload = {
        "user_id": int(telegram_id),
        "result": result,
        "allow_user_chats": True,
        "allow_bot_chats": False,
        "allow_group_chats": True,
        "allow_channel_chats": True,
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            body = (await client.post(f"{_api()}/savePreparedInlineMessage", json=payload)).json()
    except Exception as exc:  # noqa: BLE001
        log.warning("prepare share failed: %s", exc)
        return None
    if not body.get("ok"):
        log.warning("prepare share rejected: %s", body.get("description"))
        return None
    return str((body.get("result") or {}).get("id") or "") or None


async def send_previews(chat_id: int, telegram_id: int) -> int:
    """Присылает в чат все реферальные гифки ровно в том виде, в каком их получат друзья."""
    if not get_settings().bot_token:
        return 0
    sent = 0
    intro = "<b>Реферальные приглашения SEXY DROP</b>\n\nКаждая уходит из своего места в приложении:\n" + "\n".join(
        f"{i}. {html.escape(k['place'])}" for i, k in enumerate(KINDS.values(), start=1)
    )
    async with httpx.AsyncClient(timeout=60.0) as client:
        await client.post(f"{_api()}/sendMessage", json={"chat_id": chat_id, "text": intro, "parse_mode": "HTML"})
        for i, kind in enumerate(KINDS, start=1):
            path = photo_path(kind)
            if path is None:
                log.warning("ref photo %s not found", kind)
                continue
            data = {
                "chat_id": str(chat_id),
                "caption": f"<i>{i}. {html.escape(KINDS[kind]['place'])}</i>\n\n{caption(kind, telegram_id)}",
                "parse_mode": "HTML",
                "reply_markup": json.dumps(keyboard(kind, telegram_id), ensure_ascii=False),
            }
            res = await client.post(
                f"{_api()}/sendPhoto", data=data, files={"photo": (f"{kind}-photo.jpg", path.read_bytes(), "image/jpeg")}
            )
            body = res.json()
            if body.get("ok"):
                sent += 1
            else:
                log.warning("ref photo %s to %s failed: %s", kind, chat_id, body.get("description"))
    return sent


async def send_previews_to_admins_once(delay_s: float = 25.0) -> None:
    """После деплоя новой версии гифок присылает их каждому админу один раз (отметка в UserMeta)."""
    await asyncio.sleep(delay_s)
    if not get_settings().bot_token:
        return
    from sqlalchemy import func, select

    from app.api.odds import ADMIN_USERNAMES
    from app.core.db import get_session_factory
    from app.models.economy import UserMeta
    from app.models.user import User
    from app.services.economy_core import ensure_account

    try:
        async with get_session_factory()() as session:
            admins = (
                await session.execute(select(User).where(func.lower(User.username).in_(sorted(ADMIN_USERNAMES))))
            ).scalars().all()
            for admin in admins:
                await ensure_account(session, admin.id)
                meta = await session.get(UserMeta, admin.id)
                if meta is None or (meta.quests_claimed or {}).get("_refgifs") == PREVIEW_VERSION:
                    continue
                if await send_previews(admin.telegram_id, admin.telegram_id) > 0:
                    meta.quests_claimed = {**(meta.quests_claimed or {}), "_refgifs": PREVIEW_VERSION}
                    await session.commit()
                    log.info("ref photos sent to admin %s", admin.telegram_id)
    except Exception as exc:  # noqa: BLE001 — уведомление не должно ронять сервер
        log.warning("ref photos to admins failed: %s", exc)


# ---------------------------------------------------------------- готовый пост про задание «ник в профиле»

POST_VERSION = "2026-11-08-tag-v2"


def task_post_caption(telegram_id: int) -> str:
    """Готовый пост для канала/чата: ссылки спрятаны под текстом (HTML), фото — баннер задания."""
    app = html.escape(ref_link(telegram_id), quote=True)
    return (
        "⭐ <b>10 звёзд каждый день — за одну строчку в профиле!</b>\n\n"
        f'Поставь <b>@sexydropbot</b> в имя или в «О себе» — и забирай награду в '
        f'<a href="{app}">приложении SEXY DROP</a> в разделе «Заработок».\n\n'
        "<b>Как это работает</b>\n"
        "1️⃣ Добавь <code>@sexydropbot</code> в имя, фамилию или в «О себе» в Telegram\n"
        f'2️⃣ Открой <a href="{app}">задание</a> и нажми «Готово» — проверим профиль\n'
        "3️⃣ Держи ник 24 часа\n"
        "4️⃣ Через 24 часа у тебя 10 часов, чтобы забрать <b>10 ★</b> на баланс\n\n"
        "<b>Что нельзя</b>\n"
        "🚫 Убирать ник раньше времени — отсчёт сбросится, награда не начислится\n"
        "🚫 Писать его с ошибками: нужно ровно <code>@sexydropbot</code>\n"
        "🚫 Закрывать «О себе» в приватности, если ник стоит там: бот его не увидит. "
        "Либо открой «О себе» всем, либо поставь ник в имя\n"
        "🚫 Пропускать окно в 10 часов — тогда задание начнётся заново\n\n"
        "Звёзды можно обменять на TON: 100 ★ = 1 TON.\n\n"
        f'👉 <a href="{app}">Играть и забирать звёзды</a>\n'
        '💬 <a href="https://t.me/+hQUjqYtgmTA2NmQ0">Чат SEXY DROP</a> · '
        '📣 <a href="https://t.me/SexyDrop_official">Канал</a> · '
        '🛟 <a href="https://t.me/SexyDropOwner">Поддержка</a>'
    )


async def send_task_post(chat_id: int, telegram_id: int) -> bool:
    """Присылает готовый пост (фото + текст со скрытыми ссылками) в чат бота с админом."""
    if not get_settings().bot_token:
        return False
    path = next((d / "task-photo.jpg" for d in _GIF_DIRS if (d / "task-photo.jpg").is_file()), None)
    if path is None:
        log.warning("task photo not found")
        return False
    data = {
        "chat_id": str(chat_id),
        "caption": task_post_caption(telegram_id),
        "parse_mode": "HTML",
        "reply_markup": json.dumps(
            {"inline_keyboard": [[{"text": "⭐ Забрать 10 звёзд", "url": ref_link(telegram_id)}]]}, ensure_ascii=False
        ),
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        await client.post(
            f"{_api()}/sendMessage",
            json={"chat_id": chat_id, "text": "<b>Готовый пост</b> — перешлите или скопируйте в канал и чат 👇", "parse_mode": "HTML"},
        )
        body = (
            await client.post(f"{_api()}/sendPhoto", data=data, files={"photo": ("task-photo.jpg", path.read_bytes(), "image/jpeg")})
        ).json()
    if not body.get("ok"):
        log.warning("task post to %s failed: %s", chat_id, body.get("description"))
    return bool(body.get("ok"))


async def send_task_post_to_admins_once(delay_s: float = 40.0) -> None:
    """После деплоя новой версии поста присылает его каждому админу один раз (отметка в UserMeta)."""
    await asyncio.sleep(delay_s)
    if not get_settings().bot_token:
        return
    from sqlalchemy import func, select

    from app.api.odds import ADMIN_USERNAMES
    from app.core.db import get_session_factory
    from app.models.economy import UserMeta
    from app.models.user import User
    from app.services.economy_core import ensure_account

    try:
        async with get_session_factory()() as session:
            admins = (
                await session.execute(select(User).where(func.lower(User.username).in_(sorted(ADMIN_USERNAMES))))
            ).scalars().all()
            for admin in admins:
                await ensure_account(session, admin.id)
                meta = await session.get(UserMeta, admin.id)
                if meta is None or (meta.quests_claimed or {}).get("_taskpost") == POST_VERSION:
                    continue
                ok_task = await send_task_post(admin.telegram_id, admin.telegram_id)
                ok_boost = await send_boost_post(admin.telegram_id, admin.telegram_id)
                if ok_task or ok_boost:
                    meta.quests_claimed = {**(meta.quests_claimed or {}), "_taskpost": POST_VERSION}
                    await session.commit()
    except Exception as exc:  # noqa: BLE001
        log.warning("task post to admins failed: %s", exc)


def boost_caption(telegram_id: int, premium: bool = True) -> str:
    """Добивка: простым языком + инфа о курсе; премиум-эмодзи (анимированные), ссылки спрятаны под текстом."""
    from app.services.telegram_bot import em

    app = html.escape(ref_link(telegram_id), quote=True)

    def e(name: str) -> str:
        return em(name, premium)

    return (
        f"{e('spark')} <b>Не забыл про звёзды?</b>\n\n"
        "Просто и коротко:\n"
        f"{e('dot')} Поставь <code>@sexydropbot</code> в имя или в «О себе» в Telegram\n"
        f'{e("dot")} Зайди в <a href="{app}">приложение</a> и нажми «Готово»\n'
        f"{e('dot')} Через сутки забери <b>10 ★</b>. Так каждый день\n\n"
        f"{e('ton')} <b>Курс: 100 ★ = 1 TON</b>\n"
        f"{e('check')} 1 звезда = 0.01 TON, обмен от 1 звезды в разделе «Заработок»\n"
        f"{e('check')} Звёзды копятся, пока ник стоит в профиле\n\n"
        "Убрал ник — отсчёт начнётся заново.\n\n"
        f'{e("play")} <a href="{app}">Забрать звёзды</a> · '
        f'{e("friends")} <a href="https://t.me/+hQUjqYtgmTA2NmQ0">Чат</a> · '
        f'{e("support")} <a href="https://t.me/SexyDropOwner">Поддержка</a>'
    )


async def send_boost_post(chat_id: int, telegram_id: int) -> bool:
    """Присылает добивку (фото + премиум-эмодзи); если Telegram не принял премиум — обычные эмодзи."""
    if not get_settings().bot_token:
        return False
    path = next((d / "boost-photo.jpg" for d in _GIF_DIRS if (d / "boost-photo.jpg").is_file()), None)
    if path is None:
        log.warning("boost photo not found")
        return False
    markup = json.dumps({"inline_keyboard": [[{"text": "⭐ Забрать звёзды", "url": ref_link(telegram_id)}]]}, ensure_ascii=False)
    async with httpx.AsyncClient(timeout=60.0) as client:
        await client.post(
            f"{_api()}/sendMessage",
            json={"chat_id": chat_id, "text": "<b>Добивка</b> — скопируйте или перешлите в канал и чат 👇", "parse_mode": "HTML"},
        )
        body: dict[str, Any] = {}
        for premium in (True, False):
            data = {
                "chat_id": str(chat_id),
                "caption": boost_caption(telegram_id, premium),
                "parse_mode": "HTML",
                "reply_markup": markup,
            }
            body = (
                await client.post(
                    f"{_api()}/sendPhoto", data=data, files={"photo": ("boost-photo.jpg", path.read_bytes(), "image/jpeg")}
                )
            ).json()
            if body.get("ok"):
                break
            log.warning("boost post (premium=%s) to %s failed: %s", premium, chat_id, body.get("description"))
    return bool(body.get("ok"))


# ---------------------------------------------------------------- рассылка: добивка + напоминание о рефке

BROADCAST_ARMED_FOR_S = 600  # после теста админу «отправить всем» доступно 10 минут
_armed: dict[int, float] = {}


def broadcast_caption(telegram_id: int, premium: bool = True) -> str:
    """Текст рассылки: добивка про ник и курс + напоминание, что за друзей тоже можно зарабатывать по 2 ★."""
    from app.services.telegram_bot import em

    app = html.escape(ref_link(telegram_id), quote=True)

    def e(name: str) -> str:
        return em(name, premium)

    return (
        f"{e('spark')} <b>Не забыл про звёзды?</b>\n\n"
        f"{e('dot')} Поставь <code>@sexydropbot</code> в имя или в «О себе» — <b>10 ★ каждый день</b>\n"
        f'{e("dot")} Зайди в <a href="{app}">приложение</a>, нажми «Готово», через сутки забери звёзды\n\n'
        f"{e('ton')} <b>Курс: 100 ★ = 1 TON</b> — меняй в разделе «Заработок»\n\n"
        f"{e('friends')} <b>И зови друзей:</b> за каждого, кто прокрутит бесплатный кейс и вступит в чат, "
        f"тебе <b>+2 ★</b> в банк. Забирай от 15 ★.\n\n"
        f'{e("play")} <a href="{app}">Забрать звёзды</a> · '
        f'{e("channel")} <a href="https://t.me/SexyDrop_official">Канал</a> · '
        f'{e("support")} <a href="https://t.me/SexyDropOwner">Поддержка</a>'
    )


def arm_broadcast(admin_tg_id: int) -> None:
    import time as _t

    _armed[admin_tg_id] = _t.time()


def is_broadcast_armed(admin_tg_id: int) -> bool:
    import time as _t

    return _t.time() - _armed.get(admin_tg_id, 0) < BROADCAST_ARMED_FOR_S


async def _send_photo_to(client: httpx.AsyncClient, chat_id: int, photo_url: str) -> tuple[bool, str | None]:
    for premium in (True, False):
        payload = {
            "chat_id": chat_id,
            "photo": photo_url,
            "caption": broadcast_caption(chat_id, premium),
            "parse_mode": "HTML",
            "reply_markup": {"inline_keyboard": [[{"text": "⭐ Забрать звёзды", "url": ref_link(chat_id)}]]},
        }
        r = await client.post(f"{_api()}/sendPhoto", json=payload)
        if r.status_code == 429:
            await asyncio.sleep(float(r.json().get("parameters", {}).get("retry_after", 1)))
            r = await client.post(f"{_api()}/sendPhoto", json=payload)
        if r.is_success:
            return True, None
        err = str(r.json().get("description", r.status_code))
        if not premium or "emoji" not in err.lower():
            return False, err
    return False, "send failed"


async def run_boost_broadcast(ids: list[int], state: dict[str, Any]) -> None:
    """Рассылка добивки с фото; у каждого получателя в ссылках его собственная реферальная ссылка."""
    import time as _t

    photo = f"{_base_url()}/brand/ref/boost-photo.jpg"
    async with httpx.AsyncClient(timeout=20.0) as client:
        for chat_id in ids:
            try:
                ok, err = await _send_photo_to(client, chat_id, photo)
            except Exception as exc:  # noqa: BLE001
                ok, err = False, str(exc)[:200]
            state["sent" if ok else "failed"] += 1
            if err:
                state["last_error"] = err[:200]
            await asyncio.sleep(0.05)
    state["state"] = "done"
    state["finished"] = int(_t.time())
