from __future__ import annotations

import hashlib
import hmac
import json
import time
import urllib.parse
import uuid

import pytest
from httpx import AsyncClient

from app.core.security import (
    create_access_token,
    decode_access_token,
    validate_telegram_init_data,
)


def _generate_valid_init_data(
    bot_token: str,
    user_dict: dict,
    auth_date: int | None = None,
    query_id: str = "AAHFxAAA123",
) -> str:
    params = {
        "auth_date": str(auth_date if auth_date is not None else int(time.time())),
        "query_id": query_id,
        "user": json.dumps(user_dict, separators=(",", ":")),
    }
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    hash_hex = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    params["hash"] = hash_hex
    return urllib.parse.urlencode(params)


def test_token_creation_and_validation() -> None:
    user_id = uuid.uuid4()
    tg_id = 123456789
    token = create_access_token(user_id, tg_id, expires_in_seconds=60)
    claims = decode_access_token(token)

    assert claims["sub"] == str(user_id)
    assert claims["tg_id"] == tg_id
    assert claims["exp"] > time.time()


def test_token_rejects_expired() -> None:
    user_id = uuid.uuid4()
    token = create_access_token(user_id, 999, expires_in_seconds=-10)
    with pytest.raises(ValueError, match="expired"):
        decode_access_token(token)


def test_token_rejects_tampered_signature() -> None:
    token = create_access_token(uuid.uuid4(), 100)
    parts = token.split(".")
    tampered_sig = parts[2][:-2] + ("aa" if parts[2][-2:] != "aa" else "bb")
    tampered_token = f"{parts[0]}.{parts[1]}.{tampered_sig}"
    with pytest.raises(ValueError, match="signature"):
        decode_access_token(tampered_token)


def test_validate_telegram_init_data_success() -> None:
    bot_token = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    user_data = {"id": 987654321, "first_name": "Pavel", "username": "durov"}
    init_data = _generate_valid_init_data(bot_token, user_data)

    result = validate_telegram_init_data(init_data, bot_token=bot_token)
    assert result["user"]["id"] == 987654321
    assert result["user"]["first_name"] == "Pavel"
    assert result["user"]["username"] == "durov"


def test_validate_telegram_init_data_rejects_tampering() -> None:
    bot_token = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    init_data = _generate_valid_init_data(bot_token, {"id": 111, "first_name": "Alice"})
    # Tamper payload
    tampered = init_data.replace("Alice", "Mallory")
    with pytest.raises(ValueError, match="verification failed"):
        validate_telegram_init_data(tampered, bot_token=bot_token)


def test_validate_telegram_init_data_rejects_expired() -> None:
    bot_token = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    expired_date = int(time.time()) - 100_000
    init_data = _generate_valid_init_data(bot_token, {"id": 222}, auth_date=expired_date)
    with pytest.raises(ValueError, match="expired"):
        validate_telegram_init_data(init_data, bot_token=bot_token, max_age_seconds=86400)


async def test_telegram_auth_flow(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    test_token = "999999:TEST_BOT_TOKEN_FOR_PYTEST"
    monkeypatch.setenv("BOT_TOKEN", test_token)

    tg_id = int(time.time() * 1000) % 1_000_000_000 + 10_000_000
    user_payload = {
        "id": tg_id,
        "first_name": "TelegramUser",
        "username": f"tg_user_{tg_id}",
        "photo_url": "https://t.me/avatar.jpg",
    }
    init_data = _generate_valid_init_data(test_token, user_payload)

    # 1. Login with Telegram initData
    resp = await client.post(
        "/api/auth/telegram",
        json={"init_data": init_data},
    )
    assert resp.status_code == 200, resp.text
    auth_data = resp.json()
    assert auth_data["token_type"] == "bearer"
    token = auth_data["token"]
    user = auth_data["user"]
    assert user["telegram_id"] == tg_id
    assert user["username"] == f"tg_user_{tg_id}"
    assert user["referral_code"] == f"ref-{tg_id}"

    # 2. Access /api/users/me with bearer token
    me_resp = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["id"] == user["id"]
    assert me_data["telegram_id"] == tg_id

    # 3. Repeat auth with updated first name updates existing user
    user_payload["first_name"] = "UpdatedName"
    init_data_updated = _generate_valid_init_data(test_token, user_payload)
    resp2 = await client.post(
        "/api/auth/telegram",
        json={"init_data": init_data_updated},
    )
    assert resp2.status_code == 200
    user2 = resp2.json()["user"]
    assert user2["id"] == user["id"]
    assert user2["first_name"] == "UpdatedName"


async def test_referral_attribution_on_signup(client: AsyncClient) -> None:
    # Create referrer via dev auth
    referrer_tg_id = int(time.time() * 1000) % 1_000_000_000 + 20_000_000
    resp_ref = await client.post(
        "/api/auth/dev",
        json={"telegram_id": referrer_tg_id, "username": "referrer_user"},
    )
    assert resp_ref.status_code == 200
    referrer_data = resp_ref.json()["user"]
    ref_code = referrer_data["referral_code"]

    # Create referee passing referrer's referral code
    referee_tg_id = referrer_tg_id + 1
    resp_referee = await client.post(
        "/api/auth/dev",
        json={
            "telegram_id": referee_tg_id,
            "username": "referee_user",
            "referral_code": ref_code,
        },
    )
    assert resp_referee.status_code == 200
    referee_data = resp_referee.json()["user"]
    assert referee_data["referred_by_id"] == referrer_data["id"]


async def test_users_me_unauthorized(client: AsyncClient) -> None:
    resp = await client.get("/api/users/me")
    assert resp.status_code == 401
    assert "Missing" in resp.json()["detail"]

    resp_invalid = await client.get(
        "/api/users/me",
        headers={"Authorization": "Bearer invalid.token.value"},
    )
    assert resp_invalid.status_code == 401
