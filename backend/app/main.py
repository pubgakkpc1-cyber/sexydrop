import asyncio
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import get_settings
from app.core.db import dispose_engine
from app.services.economy_core import GameError
from app.services.ref_share import send_previews_to_admins_once
from app.services.telegram_bot import register_webhook


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if settings.app_env != "test":
        # Бот отвечает на /start через вебхук (если задан PUBLIC_BASE_URL и BOT_TOKEN)
        asyncio.create_task(register_webhook())
        # новые реферальные гифки — админу в бота, один раз на версию
        asyncio.create_task(send_previews_to_admins_once())
        from app.services.ref_share import send_task_post_to_admins_once

        asyncio.create_task(send_task_post_to_admins_once())
        from app.services.ref_share import send_clicker_poll_to_admins_once

        asyncio.create_task(send_clicker_poll_to_admins_once())
        from app.services.ref_share import send_back_online_to_admins_once

        asyncio.create_task(send_back_online_to_admins_once())
        from app.services.ref_share import send_update_to_admins_once

        asyncio.create_task(send_update_to_admins_once())
        from app.services.ref_share import send_invite_clicks_to_admins_once

        asyncio.create_task(send_invite_clicks_to_admins_once())
        # раз в час проверяем, что игроки не убрали ник бота из профиля
        from app.services.tag_quest import recheck_loop

        asyncio.create_task(recheck_loop())
        # цены подарков по рынку: обновление раз в час, само
        from app.services import market_prices

        asyncio.create_task(market_prices.loop())
        # сверка оплат Stars с Telegram: пропущенные оплаты зачисляются сами
        from app.services import stars_reconcile

        asyncio.create_task(stars_reconcile.loop())
    try:
        yield
    finally:
        await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="SEXY DROP API",
        version="0.7.1",
        lifespan=lifespan,
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url=None,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Client-Request-Id"],
    )
    application.include_router(api_router)

    _OPEN_DURING_WORKS = ("/api/health", "/api/maintenance", "/api/auth", "/api/telegram", "/api/admin", "/api/live")

    @application.middleware("http")
    async def _maintenance_gate(request: Request, call_next):  # type: ignore[no-untyped-def]
        path = request.url.path
        if path.startswith("/api/") and not path.startswith(_OPEN_DURING_WORKS) and request.method != "OPTIONS":
            from app.services import maintenance

            if await maintenance.is_on() and not await maintenance.token_is_admin(request.headers.get("authorization")):
                return JSONResponse(status_code=503, content={"detail": "Технические работы: бот временно не работает", "code": "maintenance"})
        return await call_next(request)

    @application.exception_handler(GameError)
    async def _game_error(_request: Request, exc: GameError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content={"detail": exc.detail, "code": exc.code})

    dist_candidates = [
        Path("/app/dist"),
        Path(__file__).resolve().parents[2] / "dist",
        Path("dist"),
    ]
    for dist_path in dist_candidates:
        if dist_path.is_dir():
            application.mount(
                "/", _FrontendFiles(directory=str(dist_path), html=True), name="frontend"
            )
            break

    return application


class _FrontendFiles(StaticFiles):
    """Статика мини-аппа: index.html не кэшируется (Telegram сразу получает новую версию),
    файлы из assets/ с хэшем в имени кэшируются навсегда."""

    async def get_response(self, path: str, scope):  # type: ignore[no-untyped-def]
        response = await super().get_response(path, scope)
        path = path.replace("\\", "/")  # на Windows Starlette отдаёт путь с обратными слэшами
        if path.startswith("assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path in ("", ".", "index.html") or path.endswith(".html") or response.media_type == "text/html":
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response


app = create_app()
