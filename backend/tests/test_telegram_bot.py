import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app
from app.services import telegram_bot


def test_caption_and_keyboard_have_play_button_and_links():
    caption = telegram_bot.build_caption(premium=False)
    assert "Добро пожаловать в SEXY DROP" in caption
    assert "2 ★" in caption
    kb = telegram_bot.build_keyboard("https://example.test/app", premium=False)
    rows = kb["inline_keyboard"]
    assert rows[0][0]["web_app"]["url"] == "https://example.test/app"
    assert {b["text"] for b in rows[1]} == {"Канал", "Поддержка"}


def test_premium_emoji_used_only_when_ids_known():
    assert "<tg-emoji" in telegram_bot.build_caption(premium=True)
    assert "<tg-emoji" not in telegram_bot.build_caption(premium=False)


def test_webhook_rejects_wrong_secret(monkeypatch):
    monkeypatch.setenv("BOT_TOKEN", "123456:TEST_TOKEN_FOR_TESTS_ONLY")
    get_settings.cache_clear()
    try:
        client = TestClient(create_app())
        assert client.post("/api/telegram/webhook/wrong", json={}).status_code == 404
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_start_message_triggers_welcome(monkeypatch):
    sent: list[int] = []

    async def fake_welcome(chat_id: int):
        sent.append(chat_id)
        return {"ok": True}

    async def fake_menu(chat_id: int):
        return None

    monkeypatch.setattr(telegram_bot, "send_welcome", fake_welcome)
    monkeypatch.setattr(telegram_bot, "_set_menu_button", fake_menu)
    handled = await telegram_bot.handle_update({"message": {"chat": {"id": 42, "type": "private"}, "text": "/start"}})
    assert handled is True
    assert sent == [42]
    # группы и не-сообщения игнорируются
    assert await telegram_bot.handle_update({"message": {"chat": {"id": -1, "type": "group"}}}) is False
    assert await telegram_bot.handle_update({"edited_message": {}}) is False
