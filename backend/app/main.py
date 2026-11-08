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
        # раз в час проверяем, что игроки не убрали ник бота из профиля
        from app.services.tag_quest import recheck_loop

        asyncio.create_task(recheck_loop())
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
