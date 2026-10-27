import os
import httpx
from dotenv import load_dotenv

load_dotenv()
token = os.getenv("BOT_TOKEN")

# 1. getMe
me = httpx.get(f"https://api.telegram.org/bot{token}/getMe").json()
print("Bot info:", me)

# 2. getChatMenuButton without chat_id
mb = httpx.get(f"https://api.telegram.org/bot{token}/getChatMenuButton").json()
print("Default Menu Button:", mb)

# 3. getUpdates to see recent chats / user IDs
updates = httpx.get(f"https://api.telegram.org/bot{token}/getUpdates").json()
print("Updates count:", len(updates.get("result", [])))
chats = []
for u in updates.get("result", []):
    msg = u.get("message") or u.get("edited_message")
    if msg and "chat" in msg:
        chats.append(msg["chat"]["id"])
chats = list(set(chats))
print("Distinct user chats:", chats)

for cid in chats:
    cmb = httpx.get(f"https://api.telegram.org/bot{token}/getChatMenuButton?chat_id={cid}").json()
    print(f"Chat {cid} menu button:", cmb)
