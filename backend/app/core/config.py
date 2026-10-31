from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_PROJECT_ROOT = _BACKEND_ROOT.parent


class Settings(BaseSettings):
    """Runtime configuration. Secrets come from the environment, never from source."""

    model_config = SettingsConfigDict(
        env_file=(_PROJECT_ROOT / ".env", _BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: Literal["development", "production", "test"] = "development"
    app_debug: bool = False
    api_host: str = "0.0.0.0"
    api_port: int = Field(default=8000, ge=1, le=65535)
    cors_origins: str = "http://localhost:4173,http://localhost:5173,http://127.0.0.1:4173,https://p01--sexydrop--86lmybxbkwwj.code.run,*"
    database_url: str = "postgresql+asyncpg://gram:gram@127.0.0.1:5432/gram"
    db_pool_size: int = Field(default=5, ge=1, le=50)
    db_max_overflow: int = Field(default=10, ge=0, le=50)

    bot_token: str = ""
    # Публичный адрес сервиса (https://...): по нему регистрируется вебхук бота. Пусто — вебхук не ставится.
    public_base_url: str = ""
    # Адрес мини-аппа для кнопки «Играть» и меню чата
    app_url: str = "https://p01--sexydrop--86lmybxbkwwj.code.run"
    # Секрет пути вебхука; пусто — вычисляется из BOT_TOKEN
    telegram_webhook_secret: str = ""
    # Пополнения: токен Crypto Pay (@CryptoBot → Crypto Pay → Create App) и адрес кошелька проекта для TON
    cryptobot_token: str = ""
    cryptobot_api_url: str = "https://pay.crypt.bot/api"
    # Публичный адрес кошелька проекта (не секрет); можно переопределить через TON_DEPOSIT_ADDRESS
    ton_deposit_address: str = "UQCTiqlyiZ0YigN0391TXbV3vZFmR6xNx9G6HeHMP4f9Le5a"
    toncenter_api_url: str = "https://toncenter.com/api/v3"
    toncenter_api_key: str = ""
    jwt_secret: str = "epic-tma-insecure-dev-secret-change-in-production"
    jwt_ttl_seconds: int = 86400 * 7
    telegram_auth_max_age_seconds: int = 86400

    @field_validator("database_url")
    @classmethod
    def require_asyncpg(cls, value: str) -> str:
        if not value.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must use the postgresql+asyncpg:// scheme")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
