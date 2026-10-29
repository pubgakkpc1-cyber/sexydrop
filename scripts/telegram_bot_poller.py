import os
import re
import time
from decimal import Decimal
import httpx
from dotenv import load_dotenv

load_dotenv()
token = os.getenv("BOT_TOKEN")
if not token:
    print("No BOT_TOKEN found")
    exit(1)

app_url = "https://p01--sexydrop--86lmybxbkwwj.code.run"
api_url = f"https://api.telegram.org/bot{token}"
ADMIN_USERNAME = "zapixxgarant"

print(f"Starting Telegram bot poller for SEXY DROP with app_url={app_url}...")
print(f"Designated admin: @{ADMIN_USERNAME}")

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
            from_user = msg.get("from", {})
            sender_username = (from_user.get("username") or "").lstrip("@").lower()
            text = (msg.get("text") or "").strip()

            # Always ensure chat menu button is set for this chat
            try:
                httpx.post(
                    f"{api_url}/setChatMenuButton",
                    json={
                        "chat_id": chat_id,
                        "menu_button": {
                            "type": "web_app",
                            "text": "Открыть SEXY DROP",
                            "web_app": {"url": app_url},
                        },
                    },
                    timeout=5.0,
                )
            except Exception as e:
                print("Failed to setChatMenuButton:", e)

            # Check if this is an admin command from @zapixxgarant
            is_admin = sender_username == ADMIN_USERNAME

            # Admin commands
            if is_admin and (text.startswith("/give") or text.startswith("/pay") or text.startswith("/send") or text.startswith("/add") or text.startswith("/выдать")):
                parts = text.split()
                if len(parts) < 3:
                    httpx.post(
                        f"{api_url}/sendMessage",
                        json={
                            "chat_id": chat_id,
                            "text": (
                                "ℹ️ **Формат команды для выдачи TON:**\n"
                                "`/give @username <сумма>`\n\n"
                                "Пример:\n"
                                "`/give @durov 25.5`\n"
                                "`/give test_user 100`"
                            ),
                            "parse_mode": "Markdown",
                        },
                        timeout=5.0,
                    )
                    continue

                target_username = parts[1].lstrip("@").strip().lower()
                try:
                    amount = Decimal(parts[2].replace(",", "."))
                    if amount <= 0:
                        raise ValueError()
                except Exception:
                    httpx.post(
                        f"{api_url}/sendMessage",
                        json={
                            "chat_id": chat_id,
                            "text": "❌ Ошибка: укажите корректное положительное число для суммы TON.",
                        },
                        timeout=5.0,
                    )
                    continue

                # Call backend admin give-ton endpoint
                try:
                    res = httpx.post(
                        f"{app_url}/api/admin/give-ton",
                        headers={"X-Admin-User": ADMIN_USERNAME},
                        json={
                            "username": target_username,
                            "amount_ton": float(amount),
                            "description": f"Выдача администратором @{ADMIN_USERNAME}",
                        },
                        timeout=10.0,
                    )
                    resp_data = res.json()

                    if res.status_code == 200 and resp_data.get("ok"):
                        new_bal = resp_data.get("new_balance")
                        recip_tg_id = resp_data.get("telegram_id")
                        httpx.post(
                            f"{api_url}/sendMessage",
                            json={
                                "chat_id": chat_id,
                                "text": (
                                    "🟢 **Транзакция успешно выполнена!**\n"
                                    "────────────────────────\n"
                                    f"👤 Получатель: **@{target_username}**\n"
                                    f"💎 Начислено: **{amount} TON**\n"
                                    f"💳 Новый баланс: **{new_bal} TON**\n"
                                    "────────────────────────\n"
                                    "⚡ Запись внесена в Ledger базы данных."
                                ),
                                "parse_mode": "Markdown",
                            },
                            timeout=5.0,
                        )

                        # Notify the recipient in Telegram if chat is available
                        if recip_tg_id:
                            try:
                                httpx.post(
                                    f"{api_url}/sendMessage",
                                    json={
                                        "chat_id": recip_tg_id,
                                        "text": (
                                            f"🎉 **Вам начислено +{amount} TON!**\n\n"
                                            f"👑 Администратор @{ADMIN_USERNAME} пополнил ваш баланс.\n"
                                            f"💳 Ваш текущий баланс: **{new_bal} TON**\n\n"
                                            "🟢 Заходите в игру и побеждайте!"
                                        ),
                                        "parse_mode": "Markdown",
                                        "reply_markup": {
                                            "inline_keyboard": [
                                                [
                                                    {
                                                        "text": "🟢 Открыть SEXY DROP",
                                                        "web_app": {"url": app_url},
                                                    }
                                                ]
                                            ]
                                        },
                                    },
                                    timeout=5.0,
                                )
                            except Exception as e:
                                print(f"Could not notify recipient {recip_tg_id}: {e}")

                    elif res.status_code == 404:
                        httpx.post(
                            f"{api_url}/sendMessage",
                            json={
                                "chat_id": chat_id,
                                "text": (
                                    f"❌ Пользователь **@{target_username}** не найден в базе данных.\n\n"
                                    "Пользователь должен хотя бы один раз запустить бота @sexydropbot, чтобы у него создался кошелёк."
                                ),
                                "parse_mode": "Markdown",
                            },
                            timeout=5.0,
                        )
                    else:
                        detail = resp_data.get("detail", "Неизвестная ошибка")
                        httpx.post(
                            f"{api_url}/sendMessage",
                            json={
                                "chat_id": chat_id,
                                "text": f"❌ Ошибка при начислении: {detail}",
                            },
                            timeout=5.0,
                        )
                except Exception as e:
                    print("Admin give-ton request failed:", e)
                    httpx.post(
                        f"{api_url}/sendMessage",
                        json={
                            "chat_id": chat_id,
                            "text": f"❌ Ошибка соединения с сервером: {e}",
                        },
                        timeout=5.0,
                    )
                continue

            if is_admin and (text == "/admin" or text == "/help" or text == "/start admin"):
                httpx.post(
                    f"{api_url}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": (
                            f"👑 **Панель Администратора (@{ADMIN_USERNAME})**\n\n"
                            "Вам доступны команды управления:\n"
                            "• `/give @username <сумма>` — выдать TON по юзернейму\n"
                            "• `/users` — список зарегистрированных игроков\n\n"
                            "Примеры:\n"
                            "`/give @ivan 15`\n"
                            "`/give zapixxgarant 100`"
                        ),
                        "parse_mode": "Markdown",
                    },
                    timeout=5.0,
                )
                continue

            if is_admin and text == "/users":
                try:
                    res = httpx.get(
                        f"{app_url}/api/admin/users",
                        headers={"X-Admin-User": ADMIN_USERNAME},
                        timeout=10.0,
                    )
                    users_list = res.json()
                    lines = [f"👥 **Всего игроков в базе:** {len(users_list)}\n"]
                    for u in users_list[:15]:
                        u_name = f"@{u['username']}" if u.get("username") else f"ID: {u['telegram_id']}"
                        lines.append(f"• {u_name} ({u.get('first_name') or 'Игрок'}): **{u.get('balance_ton', '0.000')} TON**")
                    httpx.post(
                        f"{api_url}/sendMessage",
                        json={
                            "chat_id": chat_id,
                            "text": "\n".join(lines),
                            "parse_mode": "Markdown",
                        },
                        timeout=5.0,
                    )
                except Exception as e:
                    httpx.post(f"{api_url}/sendMessage", json={"chat_id": chat_id, "text": f"Ошибка: {e}"})
                continue

            # Standard player welcome message (Luxury Emerald Green Theme)
            msg_text = (
                "🟢 **SEXY DROP — Luxury Crypto Casino & NFT Drops**\n"
                "────────────────────────\n\n"
                "💎 **Премиальная платформа в Telegram на базе TON**\n\n"
                "⚡ **Доступные игровые режимы:**\n"
                "• 🚀 **Ракетка (Crash)** — 3D космо-джет, общий полёт 24/7\n"
                "• 🎁 **Кейсы & NFT** — дроп реальных ценных подарков\n"
                "• 🎲 **Dice, Mines & Plinko** — честный Provably Fair алгоритм\n"
                "• ⚔️ **PvP Hub & TVT** — дуэли и командные битвы игроков\n"
                "• 🔄 **Upgrade & Craft** — апгрейд предметов в редкие артефакты\n\n"
                "💳 Все ставки и мгновенные выплаты строго в **TON**\n"
                "🛡️ Защищённая бухгалтерская книга транзакций (Ledger)\n\n"
                "────────────────────────\n"
                "👇 *Нажмите кнопку ниже для запуска:* "
            )

            payload = {
                "chat_id": chat_id,
                "text": msg_text,
                "parse_mode": "Markdown",
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": "🟢 Играть в SEXY DROP (TON)",
                                "web_app": {"url": app_url},
                            }
                        ],
                        [
                            {
                                "text": "💎 Открыть в браузере",
                                "url": app_url,
                            }
                        ],
                    ]
                },
            }
            httpx.post(f"{api_url}/sendMessage", json=payload, timeout=5.0)
            print(f"Replied to chat {chat_id}")

    except Exception as e:
        print("Polling error:", e)
        time.sleep(3)
