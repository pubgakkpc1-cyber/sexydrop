"""Приветствие @SexyDropBot: фото-баннер + HTML-подпись с премиум-эмодзи нашего пака.

Пак эмодзи: https://t.me/addemoji/sexydrop_by_sexydropbot (создан ботом, иконки — public/brand/emoji).
Соответствие имя -> custom_emoji_id лежит в scripts/bot_emoji_ids.json. Если id нет или Telegram
не принял премиум-эмодзи, сообщение уходит с обычными эмодзи-запасными (внутри <tg-emoji>).
"""

import json
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
BANNER = HERE.parent / "public" / "brand" / "bot-welcome.png"
CHANNEL_URL = "https://t.me/SexyDrop_official"
SUPPORT_URL = "https://t.me/SexyDropOwner"

# Запасные юникод-эмодзи (показываются, если у клиента нет Premium или id не заданы)
FALLBACK = {
    "case": "🎁", "rocket": "🚀", "upgrade": "⬆️", "ton": "💎", "trophy": "🏆",
    "bolt": "⚡", "nft": "🖼", "friends": "👥", "shield": "🛡", "play": "▶️",
    "channel": "📣", "support": "🎧", "dot": "🔸", "spark": "✨", "check": "✅",
}

try:
    EMOJI_IDS: dict[str, str] = json.loads((HERE / "bot_emoji_ids.json").read_text("utf-8"))
except Exception:
    EMOJI_IDS = {}

_file_id_cache: dict[str, str] = {}


def em(name: str, premium: bool = True) -> str:
    """HTML-вставка эмодзи: премиум, если известен id, иначе обычное."""
    fb = FALLBACK[name]
    eid = EMOJI_IDS.get(name)
    if premium and eid:
        return f'<tg-emoji emoji-id="{eid}">{fb}</tg-emoji>'
    return fb


def build_caption(premium: bool = True) -> str:
    e = lambda n: em(n, premium)  # noqa: E731
    return (
        f"{e('spark')} <b>Добро пожаловать в SEXY DROP!</b>\n"
        "NFT-подарки и игры в Telegram — всё в TON.\n\n"
        f"{e('rocket')} <b>Ракета</b> — лови иксы и забирай выигрыш до взрыва\n"
        f"{e('case')} <b>Кейсы</b> — открывай и выбивай NFT-подарки\n"
        f"{e('upgrade')} <b>Апгрейд</b> — меняй подарок на более ценный\n"
        f"{e('trophy')} <b>Рейтинг</b> — соревнуйся с другими игроками\n"
        f"{e('friends')} <b>Друзья</b> — приглашай и получай реферальные бонусы\n\n"
        f"{e('bolt')} <b>Авто-выдача.</b> Выигранные NFT-подарки выдаёт менеджер автоматически — "
        "прямо на твой аккаунт Telegram.\n"
        f"{e('shield')} <b>Прозрачно.</b> Баланс, ставки и вывод — в TON, история игр всегда в профиле.\n\n"
        f"{e('play')} Жми «Играть» и забирай свой дроп!"
    )


def build_keyboard(app_url: str, premium: bool = True) -> dict:
    def btn(text: str, icon: str, style: str | None = None, **target) -> dict:
        b: dict = {"text": text, **target}
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


def _send(api_url: str, chat_id: int, app_url: str, premium: bool) -> dict:
    data = {
        "chat_id": chat_id,
        "caption": build_caption(premium),
        "parse_mode": "HTML",
        "reply_markup": json.dumps(build_keyboard(app_url, premium), ensure_ascii=False),
    }
    cached = _file_id_cache.get("banner")
    if cached:
        data["photo"] = cached
        return httpx.post(f"{api_url}/sendPhoto", data=data, timeout=30.0).json()
    with open(BANNER, "rb") as fh:
        res = httpx.post(f"{api_url}/sendPhoto", data=data, files={"photo": ("welcome.png", fh, "image/png")}, timeout=60.0).json()
    if res.get("ok"):
        sizes = res["result"].get("photo") or []
        if sizes:
            _file_id_cache["banner"] = sizes[-1]["file_id"]
    return res


def send_welcome(api_url: str, chat_id: int, app_url: str) -> dict:
    """Отправляет приветствие; при отказе Telegram от премиум-эмодзи шлёт обычную версию."""
    res = _send(api_url, chat_id, app_url, premium=True)
    if not res.get("ok"):
        print("welcome(premium) failed:", res.get("description"))
        res = _send(api_url, chat_id, app_url, premium=False)
        if not res.get("ok"):
            print("welcome(plain) failed:", res.get("description"))
    return res
