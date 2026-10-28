from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import get_settings
from app.core.db import dispose_engine
from app.core.realtime import crash_manager


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    crash_task = None
    if settings.app_env != "test":
        # Server-authoritative Crash cycle; disabled under tests, which drive
        # the manager directly with controlled `step()` calls.
        crash_task = crash_manager.start()
    try:
        yield
    finally:
        if crash_task is not None:
            await crash_manager.stop()
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

    dist_candidates = [
        Path("/app/dist"),
        Path(__file__).resolve().parents[2] / "dist",
        Path("dist"),
    ]
    for dist_path in dist_candidates:
        if dist_path.is_dir():
            application.mount(
                "/", StaticFiles(directory=str(dist_path), html=True), name="frontend"
            )
            break

    return application


app = create_app()
