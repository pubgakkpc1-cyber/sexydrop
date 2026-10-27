import os
import httpx
from dotenv import load_dotenv

load_dotenv()
token = os.getenv("BOT_TOKEN")

app_url = "https://fire-men-permitted-reporting.trycloudflare.com/"
chat_id = 7440917377

# 1. Update default menu button
r_def = httpx.post(
    f"https://api.telegram.org/bot{token}/setChatMenuButton",
    json={
        "menu_button": {
            "type": "web_app",
            "text": "Открыть GiftCase",
            "web_app": {"url": app_url}
        }
    }
)
print("Default menu button:", r_def.json())

# 2. Update user chat menu button
r_user = httpx.post(
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
print("User chat menu button:", r_user.json())

# 3. Send message with WebApp launch button
msg = (
    "✨ **GiftCase Mini App активен и готов к игре!**\n\n"
    "⚙️ **Обновление туннеля и прокси:**\n"
    "• Vite preview теперь прозрачно проксирует `/api` напрямую в FastAPI контейнер;\n"
    "• Полная поддержка всех устройств (iOS, Android, Telegram Desktop);\n"
    "• Реализованы все механики TIER 0 – TIER 7 (22 кейса, 7 игр, инвентарь, баланс, рейтинг).\n\n"
    "👇 **Нажмите кнопку ниже для запуска:**"
)

payload = {
    "chat_id": chat_id,
    "text": msg,
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
print("Send message:", r_msg.json())
