from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings, get_settings


def test_database_url_must_use_asyncpg(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://gram:gram@localhost:5432/gram")
    get_settings.cache_clear()
    with pytest.raises(ValidationError):
        Settings()


def test_settings_load_cors_and_port(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://gram:gram@127.0.0.1:5432/gram",
    )
    monkeypatch.setenv("API_PORT", "8000")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:4173, http://localhost:5173")
    get_settings.cache_clear()
    settings = Settings()
    assert settings.api_port == 8000
    assert settings.cors_origin_list == [
        "http://localhost:4173",
        "http://localhost:5173",
    ]


def test_get_settings_is_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://gram:gram@127.0.0.1:5432/gram",
    )
    get_settings.cache_clear()
    first = get_settings()
    second = get_settings()
    assert first is second
