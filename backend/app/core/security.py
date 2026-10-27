from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import urllib.parse
from typing import Any
import uuid

from app.core.config import get_settings


def _urlsafe_b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _urlsafe_b64decode(data_str: str) -> bytes:
    padding = "=" * ((4 - len(data_str) % 4) % 4)
    return base64.urlsafe_b64decode((data_str + padding).encode("ascii"))


def create_access_token(
    user_id: uuid.UUID | str,
    telegram_id: int,
    expires_in_seconds: int | None = None,
) -> str:
    """Create a signed JWT-like HS256 access token without third-party dependencies."""
    settings = get_settings()
    ttl = expires_in_seconds if expires_in_seconds is not None else settings.jwt_ttl_seconds
    now = int(time.time())

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user_id),
        "tg_id": telegram_id,
        "iat": now,
        "exp": now + ttl,
    }

    header_bytes = json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")

    signing_input = f"{_urlsafe_b64encode(header_bytes)}.{_urlsafe_b64encode(payload_bytes)}"
    secret_bytes = settings.jwt_secret.encode("utf-8")
    signature = hmac.new(secret_bytes, signing_input.encode("ascii"), hashlib.sha256).digest()

    return f"{signing_input}.{_urlsafe_b64encode(signature)}"


def decode_access_token(token: str) -> dict[str, Any]:
    """Verify and decode the signed HS256 access token.

    Raises ValueError on invalid signature, malformed token, or expiration.
    """
    settings = get_settings()
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid token format")

    header_b64, payload_b64, signature_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}"
    secret_bytes = settings.jwt_secret.encode("utf-8")
    expected_sig = hmac.new(secret_bytes, signing_input.encode("ascii"), hashlib.sha256).digest()

    try:
        actual_sig = _urlsafe_b64decode(signature_b64)
    except Exception as exc:
        raise ValueError("Malformed signature") from exc

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("Invalid token signature")

    try:
        payload_bytes = _urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception as exc:
        raise ValueError("Malformed token payload") from exc

    exp = payload.get("exp")
    if exp is None or not isinstance(exp, (int, float)):
        raise ValueError("Token missing valid expiration")

    if time.time() > exp:
        raise ValueError("Token has expired")

    return payload


def validate_telegram_init_data(
    init_data_raw: str,
    bot_token: str | None = None,
    max_age_seconds: int | None = None,
) -> dict[str, Any]:
    """Validate Telegram WebApp initData string using HMAC-SHA256 according to Telegram specification.

    Steps:
    1. Parse query string pairs.
    2. Extract 'hash' param.
    3. Sort remaining pairs by key: 'key=value\n...'
    4. secret_key = HMAC_SHA256(b"WebAppData", bot_token)
    5. calculated_hash = HMAC_SHA256(secret_key, data_check_string).hexdigest()
    6. Compare calculated_hash with received hash.
    7. Check auth_date expiration.
    8. Parse 'user' JSON if present.

    Returns dict containing 'user' (parsed dict) and other validated params.
    """
    settings = get_settings()
    token = bot_token or settings.bot_token
    if not token:
        raise ValueError("BOT_TOKEN is not configured")

    max_age = (
        max_age_seconds
        if max_age_seconds is not None
        else settings.telegram_auth_max_age_seconds
    )

    try:
        parsed_qsl = urllib.parse.parse_qsl(init_data_raw, keep_blank_values=True)
    except Exception as exc:
        raise ValueError("Malformed initData string") from exc

    params: dict[str, str] = {}
    received_hash: str | None = None
    for k, v in parsed_qsl:
        if k == "hash":
            received_hash = v
        else:
            params[k] = v

    if not received_hash:
        raise ValueError("Missing 'hash' parameter in initData")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))

    # Telegram algorithm: secret_key = HMAC-SHA256("WebAppData", bot_token)
    secret_key = hmac.new(b"WebAppData", token.encode("utf-8"), hashlib.sha256).digest()
    calculated_hash = hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise ValueError("Telegram initData signature verification failed")

    auth_date_str = params.get("auth_date")
    if auth_date_str:
        try:
            auth_date = int(auth_date_str)
        except ValueError as exc:
            raise ValueError("Invalid auth_date") from exc

        if max_age > 0 and (time.time() - auth_date > max_age):
            raise ValueError("Telegram initData is expired")

    user_data: dict[str, Any] = {}
    if "user" in params:
        try:
            user_data = json.loads(params["user"])
        except Exception as exc:
            raise ValueError("Malformed 'user' JSON in initData") from exc

    return {
        "user": user_data,
        "auth_date": int(auth_date_str) if auth_date_str else None,
        "query_id": params.get("query_id"),
        "raw_params": params,
    }
