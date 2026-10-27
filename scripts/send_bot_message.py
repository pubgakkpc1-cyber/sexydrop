import os
import httpx
from dotenv import load_dotenv

load_dotenv()
token = os.getenv("BOT_TOKEN")

app_url = "https://b87117d07da9d8.lhr.life/"
chat_id = 7440917377

# 1. Also explicitly setChatMenuButton for this chat_id
r_menu = httpx.post(
    f"https://api.telegram.org/bot{token}/setChatMenuButton",
    json={
        "chat_id": chat_id,
        "menu_button": {
            "type": "web_app",
            "text": "Открыть GiftCase",
            "web_app": {"url": app_url}
        }
    }
)
print("Set menu button for user chat:", r_menu.json())

# 2. Send interactive message with inline keyboard WebApp button
msg_text = (
    "🎁 **GiftCase TMA готов к открытию!**\n\n"
    "✨ Все 7 TIER мастер-плана полностью реализованы:\n"
    "• Кейсы (20 платных + 2 бесплатных с серверным кулдауном)\n"
    "• Игры: Ракетка (Crash), Dice, Mines, Plinko, Upgrade, Craft, Spins\n"
    "• Инвентарь и атомарная продажа за GRAM\n"
    "• PvP Hub (Jackpot, Ice vs Fire)\n"
    "• Задания, Рейтинг, Реферальная программа\n"
    "• Backend: FastAPI + PostgreSQL + Docker\n\n"
    "👇 Нажмите кнопку ниже для запуска Mini App:"
)

payload = {
    "chat_id": chat_id,
    "text": msg_text,
    "parse_mode": "Markdown",
    "reply_markup": {
        "inline_keyboard": [
            [
                {
                    "text": "🚀 Открыть GiftCase (Mini App)",
                    "web_app": {"url": app_url}
                }
            ],
            [
                {
                    "text": "🌐 Открыть в браузере",
                    "url": app_url
                }
            ]
        ]
    }
}

r_msg = httpx.post(f"https://api.telegram.org/bot{token}/sendMessage", json=payload)
print("Send message result:", r_msg.json())
