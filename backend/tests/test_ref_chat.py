"""Чат SEXY DROP: удаление «вступил/покинул», проверка участия друзей (без базы)."""

from __future__ import annotations

from typing import Any

import pytest

from app.core.config import get_settings
from app.services import ref_chat, telegram_bot

CHAT = -1004442964935


class _Resp:
    def __init__(self, body: dict[str, Any]) -> None:
        self._body = body

    def json(self) -> dict[str, Any]:
        return self._body


class _Client:
    calls: list[tuple[str, dict[str, Any]]] = []

    def __init__(self, *a: Any, **k: Any) -> None:
        pass

    async def __aenter__(self) -> "_Client":
        return self

    async def __aexit__(self, *a: Any) -> None:
        return None

    async def post(self, url: str, json: dict[str, Any] | None = None, **k: Any) -> _Resp:
        _Client.calls.append((url.rsplit("/", 1)[-1], json or {}))
        return _Resp({"ok": True, "result": True})

    async def get(self, url: str, params: dict[str, Any] | None = None, **k: Any) -> _Resp:
        uid = int((params or {}).get("user_id", 0))
        _Client.calls.append(("getChatMember", params or {}))
        status = "member" if uid == 1 else "left"
        return _Resp({"ok": True, "result": {"status": status}})


@pytest.fixture
def fake_telegram(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, dict[str, Any]]]:
    monkeypatch.setenv("BOT_TOKEN", "123:abc")
    monkeypatch.setenv("REF_CHAT_ID", str(CHAT))
    get_settings.cache_clear()
    _Client.calls = []
    monkeypatch.setattr(telegram_bot.httpx, "AsyncClient", _Client)
    monkeypatch.setattr(ref_chat.httpx, "AsyncClient", _Client)
    ref_chat.clear_cache_for_tests()
    return _Client.calls


async def test_bot_deletes_join_and_leave_messages_in_chat(fake_telegram: list) -> None:
    join = {"message": {"message_id": 7, "chat": {"id": CHAT, "type": "supergroup"}, "new_chat_members": [{"id": 5}]}}
    leave = {"message": {"message_id": 8, "chat": {"id": CHAT, "type": "supergroup"}, "left_chat_member": {"id": 5}}}
    assert await telegram_bot.handle_update(join) is True
    assert await telegram_bot.handle_update(leave) is True
    assert fake_telegram == [
        ("deleteMessage", {"chat_id": CHAT, "message_id": 7}),
        ("deleteMessage", {"chat_id": CHAT, "message_id": 8}),
    ]


async def test_bot_ignores_other_groups_and_plain_messages(fake_telegram: list) -> None:
    other = {"message": {"message_id": 1, "chat": {"id": -100999, "type": "supergroup"}, "new_chat_members": [{"id": 5}]}}
    text = {"message": {"message_id": 2, "chat": {"id": CHAT, "type": "supergroup"}, "text": "привет"}}
    assert await telegram_bot.handle_update(other) is False
    assert await telegram_bot.handle_update(text) is False
    assert fake_telegram == []


async def test_members_checks_chat_and_caches(fake_telegram: list) -> None:
    assert await ref_chat.members([1, 2]) == {1: True, 2: False}
    assert await ref_chat.members([1, 2]) == {1: True, 2: False}
    assert len([c for c in fake_telegram if c[0] == "getChatMember"]) == 2  # второй раз — из кэша


async def test_members_without_token_does_not_punish(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BOT_TOKEN", "")
    get_settings.cache_clear()
    ref_chat.clear_cache_for_tests()
    assert await ref_chat.members([1]) == {1: None}


def test_history_keeps_newest_first_and_limit() -> None:
    claimed: dict[str, Any] = {}
    for i in range(40):
        ref_chat.add_log(claimed, 2, f"друг {i}", now_ms=i)
    log = claimed[ref_chat.LOG_KEY]
    assert len(log) == ref_chat.LOG_LIMIT and log[0]["t"] == "друг 39"


def test_crash_payout_equal_to_nft_price_picks_a_gift() -> None:
    from app.core import catalog

    ids = catalog.gifts_priced(6400)
    assert ids and all(i.rsplit("-", 1)[-1].isdigit() for i in ids)
    assert catalog.gifts_priced(1) == []  # нет NFT с такой ценой — выплата в TON


def test_tag_quest_stages() -> None:
    from app.services import tag_quest as t

    assert t.view(None, now=1000)["stage"] == 1
    st = {"started_at": 1000}
    assert t.view(st, now=1000 + 5)["stage"] == 2
    assert t.view(st, now=1000 + t.HOLD_MS + 1)["stage"] == 3
    assert t.view(st, now=1000 + t.HOLD_MS + t.CLAIM_WINDOW_MS + 5)["stage"] == 1  # не забрал вовремя
    assert t.REWARD_STARS == 10


def test_tag_matching_ignores_case_spaces_and_invisible_chars() -> None:
    from app.services import tag_quest as t

    assert t._has("Вася @SexyDropBot") and t._has("мой бот @sexydrop​bot") and t._has("https://t.me/SexyDropBot")
    assert not t._has("@sexydrop_bot") and not t._has("")
