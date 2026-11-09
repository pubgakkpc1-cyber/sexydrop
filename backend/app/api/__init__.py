from fastapi import APIRouter

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.broadcast import router as broadcast_router
from app.api.clicker import router as clicker_router
from app.api.deposits import router as deposits_router
from app.api.health import router as health_router
from app.api.live import router as live_router
from app.api.odds import router as odds_router
from app.api.play import router as play_router
from app.api.referrals import router as referrals_router
from app.api.stats import router as stats_router
from app.api.subscriptions import router as subscriptions_router
from app.api.telegram import router as telegram_router
from app.api.wallet import router as wallet_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(admin_router)
api_router.include_router(auth_router)
api_router.include_router(wallet_router)
api_router.include_router(telegram_router)
api_router.include_router(deposits_router)
api_router.include_router(subscriptions_router)
api_router.include_router(stats_router)
api_router.include_router(referrals_router)
api_router.include_router(odds_router)
api_router.include_router(play_router)
api_router.include_router(broadcast_router)
api_router.include_router(clicker_router)
api_router.include_router(live_router)
