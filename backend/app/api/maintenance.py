from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Header
from pydantic import BaseModel

from app.api.broadcast import _admin
from app.api.odds import ADMIN_USERNAMES
from app.core.security import validate_telegram_init_data
from app.services import maintenance

router = APIRouter(prefix="/api", tags=["maintenance"])


class MaintenanceBody(BaseModel):
    on: bool


@router.get("/maintenance")
async def maintenance_state(x_telegram_init_data: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    """Публичный статус для экрана «Технические работы». Админ проходит внутрь и при включённых работах."""
    admin = False
    if x_telegram_init_data:
        try:
            user = validate_telegram_init_data(x_telegram_init_data).get("user") or {}
            admin = str(user.get("username") or "").lower().lstrip("@") in ADMIN_USERNAMES
        except ValueError:
            admin = False
    return {"on": await maintenance.is_on(), "admin": admin}


@router.post("/admin/maintenance")
async def maintenance_set(body: MaintenanceBody, x_telegram_init_data: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    _admin(x_telegram_init_data)
    await maintenance.set_on(body.on)
    return {"on": body.on}
