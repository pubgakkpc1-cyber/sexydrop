from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.core.db import get_engine

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    database: Literal["up"]
    alembic_revision: str
    postgres_version: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    engine = get_engine()
    try:
        async with engine.connect() as conn:
            ping = (await conn.execute(text("SELECT 1"))).scalar_one()
            if ping != 1:
                raise RuntimeError("database ping failed")
            revision_row = (
                await conn.execute(
                    text(
                        "SELECT version_num FROM alembic_version LIMIT 1"
                    )
                )
            ).first()
            pg_version = (await conn.execute(text("SHOW server_version"))).scalar_one()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"status": "unavailable", "database": "down", "reason": str(exc)},
        ) from exc

    if revision_row is None:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unavailable",
                "database": "up",
                "reason": "alembic migrations are not applied",
            },
        )

    return HealthResponse(
        status="ok",
        database="up",
        alembic_revision=str(revision_row[0]),
        postgres_version=str(pg_version),
    )
