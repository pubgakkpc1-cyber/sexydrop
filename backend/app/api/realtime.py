from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from decimal import Decimal
import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_session
from app.core.realtime import broadcaster, crash_manager
from app.models.user import User

router = APIRouter(tags=["realtime"])


class BroadcastDropPayload(BaseModel):
    user_name: str
    gift_id: str
    gift_name: str
    rarity: str
    image_url: str
    case_id: str
    price_gram: Decimal


@router.get("/api/realtime/live-drops")
async def sse_live_drops() -> StreamingResponse:
    """Stream real-time drop events to clients via Server-Sent Events (SSE)."""
    q = broadcaster.subscribe()

    async def event_generator() -> AsyncIterator[str]:
        try:
            # Yield initial connection message
            yield "event: connected\ndata: {\"status\": \"connected\"}\n\n"
            while True:
                try:
                    data = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield data
                except asyncio.TimeoutError:
                    # Heartbeat keepalive every 15s
                    yield "event: ping\ndata: {}\n\n"
        finally:
            broadcaster.unsubscribe(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/api/realtime/broadcast-drop")
async def trigger_broadcast_drop(
    payload: BroadcastDropPayload,
) -> dict[str, str]:
    await broadcaster.broadcast_drop(
        user_name=payload.user_name,
        gift_id=payload.gift_id,
        gift_name=payload.gift_name,
        rarity=payload.rarity,
        image_url=payload.image_url,
        case_id=payload.case_id,
        price_gram=payload.price_gram,
    )
    return {"status": "broadcasted"}


@router.websocket("/api/ws/crash")
async def ws_crash_endpoint(websocket: WebSocket) -> None:
    """Real-time Crash WebSocket connection."""
    await websocket.accept()
    crash_manager.add_socket(websocket)
    try:
        # Send current round state on connection
        await websocket.send_text(json.dumps(crash_manager.get_state()))
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
            except Exception:
                await websocket.send_text(json.dumps({"error": "invalid_json"}))
                continue

            action = msg.get("action")
            if action == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif action == "get_state":
                await websocket.send_text(json.dumps(crash_manager.get_state()))
            else:
                await websocket.send_text(json.dumps({"type": "ack", "action": action}))
    except WebSocketDisconnect:
        crash_manager.remove_socket(websocket)
    except Exception:
        crash_manager.remove_socket(websocket)
