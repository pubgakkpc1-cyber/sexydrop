import os
import time
import httpx
from dotenv import load_dotenv

load_dotenv()
token = os.getenv("BOT_TOKEN")
if not token:
    print("No BOT_TOKEN found")
    exit(1)

app_url = "https://p01--sexydrop--86lmybxbkwwj.code.run/"
api_url = f"https://api.telegram.org/bot{token}"

print(f"Starting Telegram bot poller for SEXY DROP with app_url={app_url}...")

offset = 0
while True:
    try:
        r = httpx.get(f"{api_url}/getUpdates", params={"offset": offset, "timeout": 20}, timeout=30.0)
        data = r.json()
        if not data.get("ok"):
            time.sleep(2)
            continue
            
        for update in data.get("result", []):
            offset = update["update_id"] + 1
            msg = update.get("message")
            if not msg:
                continue
                
            chat_id = msg.get("chat", {}).get("id")
            text = msg.get("text", "")
            
            # Update menu button for this chat
            httpx.post(
                f"{api_url}/setChatMenuButton",
                json={
                    "chat_id": chat_id,
                    "menu_button": {
                        "type": "web_app",
                        "text": "Открыть SEXY DROP",
                        "web_app": {"url": app_url}
                    }
                },
                timeout=5.0
            )
            
            msg_text = (
                "🎰 **Добро пожаловать в SEXY DROP!**\n\n"
                "✨ Полный функционал проекта готов к игре:\n"
                "• Все кейсы с актуальными ценами\n"
                "• Игра «Ракетка» (Crash) с плавным таймером и ракетой\n"
                "• Все игры (Dice, Mines, Plinko, Upgrade, Craft, Spins, PvP)\n"
                "• Баланс и ставки строго в **TON** (от 0.1 TON)\n"
                "• Тёмный неоновый дизайн без лишнего визуального шума\n\n"
                "👇 Нажми на кнопку ниже, чтобы запустить игру:"
            )
            
            payload = {
                "chat_id": chat_id,
                "text": msg_text,
                "parse_mode": "Markdown",
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": "🚀 Играть в SEXY DROP",
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
            httpx.post(f"{api_url}/sendMessage", json=payload, timeout=5.0)
            print(f"Replied to chat {chat_id}")
            
    except Exception as e:
        print("Polling error:", e)
        time.sleep(3)
