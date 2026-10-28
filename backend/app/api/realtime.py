from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from decimal import Decimal
import json
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.db import get_session_factory
from app.core.realtime import (
    CrashGameError,
    broadcaster,
    crash_manager,
)
from app.core.security import decode_access_token
from app.services.user_service import get_user_by_id

router = APIRouter(tags=["realtime"])

# Authenticated user per active WebSocket connection (user_id associated on "auth").
_ws_users: dict[WebSocket, uuid.UUID] = {}


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
    """Real-time Crash WebSocket connection.

    Clients must send `{"action":"auth","token":"<jwt>"}` before betting.
    After that: `bet`, `cashout`, `get_state`, `ping`.
    """
    await websocket.accept()
    crash_manager.add_socket(websocket)
    # No user is associated until a valid "auth" message arrives.
    try:
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
                await websocket.send_text(
                    json.dumps(crash_manager.get_state(), ensure_ascii=False)
                )
            elif action == "auth":
                await _handle_auth(websocket, msg.get("token"))
            elif action in ("bet", "cashout"):
                user_id = _ws_users.get(websocket)
                if action == "cashout":
                    if user_id is None:
                        await websocket.send_text(
                            json.dumps({"error": "auth_required"})
                        )
                        continue
                    try:
                        result = await crash_manager.cashout(user_id=user_id)
                    except CrashGameError as exc:
                        await websocket.send_text(
                            json.dumps({"error": str(exc), "type": "cashout_error"})
                        )
                        continue
                    await websocket.send_text(json.dumps(result, ensure_ascii=False))
                else:
                    if user_id is None:
                        await websocket.send_text(
                            json.dumps({"error": "auth_required"})
                        )
                        continue
                    try:
                        bet_gram = Decimal(str(msg.get("bet_gram", "")))
                        auto_cashout = None
                        if msg.get("auto_cashout") is not None:
                            auto_cashout = Decimal(str(msg["auto_cashout"]))
                        result = await crash_manager.place_bet(
                            user_id=user_id,
                            bet_gram=bet_gram,
                            client_request_id=msg.get("client_request_id"),
                            auto_cashout=auto_cashout,
                        )
                    except (CrashGameError, ArithmeticError, ValueError) as exc:
                        await websocket.send_text(
                            json.dumps({"error": str(exc), "type": "bet_error"})
                        )
                        continue
                    await websocket.send_text(json.dumps(result, ensure_ascii=False))
            else:
                await websocket.send_text(
                    json.dumps({"type": "ack", "action": action}, ensure_ascii=False)
                )
    except WebSocketDisconnect:
        crash_manager.remove_socket(websocket)
        _ws_users.pop(websocket, None)
    except Exception:
        crash_manager.remove_socket(websocket)
        _ws_users.pop(websocket, None)


async def _handle_auth(websocket: WebSocket, token: str | None) -> None:
    if not token:
        await websocket.send_text(json.dumps({"error": "missing_token", "type": "auth_error"}))
        return
    try:
        payload = decode_access_token(token)
        sub = payload.get("sub")
        if not sub:
            raise ValueError("Token subject missing")
        user_uuid = uuid.UUID(str(sub))
    except Exception as exc:
        await websocket.send_text(
            json.dumps({"error": f"Invalid token: {exc}", "type": "auth_error"})
        )
        return

    # Confirm the user still exists (cheap DB hit only on auth).
    session_factory = get_session_factory()
    async with session_factory() as session:
        user = await get_user_by_id(session, user_uuid)
    if user is None:
        await websocket.send_text(json.dumps({"error": "user_not_found", "type": "auth_error"}))
        return

    _ws_users[websocket] = user_uuid
    await websocket.send_text(
        json.dumps({"type": "auth_ok", "user_id": str(user_uuid)}, ensure_ascii=False)
    )
