from fastapi import APIRouter

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.cases import router as cases_router
from app.api.catalog import router as catalog_router
from app.api.games import router as games_router
from app.api.health import router as health_router
from app.api.inventory import router as inventory_router
from app.api.realtime import router as realtime_router
from app.api.wallet import router as wallet_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(admin_router)
api_router.include_router(auth_router)
api_router.include_router(wallet_router)
api_router.include_router(catalog_router)
api_router.include_router(inventory_router)
api_router.include_router(cases_router)
api_router.include_router(games_router)
api_router.include_router(realtime_router)
