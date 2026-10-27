from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.inventory import CatalogGiftRead
from app.services.inventory_service import get_catalog_gift_by_id, get_catalog_gifts

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/gifts", response_model=list[CatalogGiftRead])
async def list_gifts(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[CatalogGiftRead]:
    gifts = await get_catalog_gifts(session)
    return [CatalogGiftRead.model_validate(g) for g in gifts]


@router.get("/gifts/{gift_id}", response_model=CatalogGiftRead)
async def get_gift(
    gift_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CatalogGiftRead:
    gift = await get_catalog_gift_by_id(session, gift_id)
    if gift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Gift '{gift_id}' not found in catalog",
        )
    return CatalogGiftRead.model_validate(gift)
