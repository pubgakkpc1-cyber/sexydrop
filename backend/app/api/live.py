from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import catalog
from app.core.db import get_session
from app.models.economy import PlayRound

router = APIRouter(prefix="/api/live", tags=["live"])


@router.get("")
async def live_feed(session: Annotated[AsyncSession, Depends(get_session)]) -> dict[str, Any]:
    """Настоящая лента: последние дропы NFT из платных кейсов (без данных игроков)."""
    rows = (
        await session.execute(
            select(PlayRound)
            .where(PlayRound.game == "case", PlayRound.status == "done", PlayRound.bet_minor > 0)
            .order_by(desc(PlayRound.created_at))
            .limit(60)
        )
    ).scalars().all()
    drops: list[dict[str, Any]] = []
    for r in rows:
        gid = (r.result or {}).get("gift_id")
        if not gid or catalog.is_ton_prize(gid):
            continue
        drops.append({"id": str(r.id), "gift_id": gid, "case_id": r.case_id, "ts": int(r.created_at.timestamp())})
        if len(drops) >= 14:
            break
    return {"drops": drops}
