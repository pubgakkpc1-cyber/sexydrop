from __future__ import annotations

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _alembic_config() -> Config:
    return Config(str(BACKEND_ROOT / "alembic.ini"))


@pytest.fixture(scope="module")
def applied_migrations() -> None:
    command.upgrade(_alembic_config(), "head")


@pytest.mark.usefixtures("applied_migrations")
async def test_postgres_select_one() -> None:
    engine = create_async_engine(get_settings().database_url)
    try:
        async with engine.connect() as conn:
            value = (await conn.execute(text("SELECT 1"))).scalar_one()
            assert value == 1
            version = (await conn.execute(text("SHOW server_version"))).scalar_one()
            major = int(str(version).split(".")[0])
            assert major >= 16
    finally:
        await engine.dispose()


@pytest.mark.usefixtures("applied_migrations")
async def test_foundation_objects_exist() -> None:
    engine = create_async_engine(get_settings().database_url)
    try:
        async with engine.connect() as conn:
            pgcrypto = (
                await conn.execute(
                    text("SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'")
                )
            ).scalar_one_or_none()
            assert pgcrypto == 1
            domain = (
                await conn.execute(
                    text(
                        """
                        SELECT numeric_precision, numeric_scale
                        FROM information_schema.domains
                        WHERE domain_name = 'gram_amount'
                        """
                    )
                )
            ).one()
            assert int(domain.numeric_precision) == 20
            assert int(domain.numeric_scale) == 3
            revision = (
                await conn.execute(text("SELECT version_num FROM alembic_version"))
            ).scalar_one()
            assert revision == "0006_game_sessions"
            await conn.execute(text("SELECT CAST(0.009 AS gram_amount)"))
    finally:
        await engine.dispose()

    engine_check = create_async_engine(get_settings().database_url)
    try:
        async with engine_check.connect() as conn:
            with pytest.raises(Exception):
                await conn.execute(text("SELECT CAST(-0.001 AS gram_amount)"))
    finally:
        await engine_check.dispose()


@pytest.mark.usefixtures("applied_migrations")
async def test_health_reports_migration(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"] == "up"
    assert payload["alembic_revision"] == "0006_game_sessions"
    assert payload["postgres_version"]
