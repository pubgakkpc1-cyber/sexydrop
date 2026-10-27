from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from decimal import Decimal
import json
import secrets
from typing import Any, Literal
import uuid

from starlette.websockets import WebSocket


class EventBroadcaster:
    """Manages SSE subscriptions for real-time live events (Live Drops, PVP, Jackpot)."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[str]] = set()

    def subscribe(self) -> asyncio.Queue[str]:
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[str]) -> None:
        self._subscribers.discard(q)

    async def broadcast_drop(
        self,
        *,
        user_name: str,
        gift_id: str,
        gift_name: str,
        rarity: str,
        image_url: str,
        case_id: str,
        price_gram: Decimal,
    ) -> None:
        payload = {
            "type": "drop",
            "user_name": user_name,
            "gift_id": gift_id,
            "gift_name": gift_name,
            "rarity": rarity,
            "image_url": image_url,
            "case_id": case_id,
            "price_gram": str(price_gram),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        data = f"data: {json.dumps(payload)}\n\n"
        dead: list[asyncio.Queue[str]] = []
        for q in self._subscribers:
            try:
                q.put_nowait(data)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self._subscribers.discard(q)


broadcaster = EventBroadcaster()


class CrashGameManager:
    """Manages a centralized real-time Crash game cycle for WebSocket clients."""

    def __init__(self) -> None:
        self.phase: Literal["betting", "flying", "crashed"] = "betting"
        self.round_id: uuid.UUID = uuid.uuid4()
        self.multiplier: Decimal = Decimal("1.00")
        self.crash_point: Decimal = Decimal("1.50")
        self.countdown_remaining: float = 5.0
        self.active_bets: dict[uuid.UUID, dict[str, Any]] = {}
        self.history: list[dict[str, Any]] = []
        self._sockets: set[WebSocket] = set()

    def add_socket(self, ws: WebSocket) -> None:
        self._sockets.add(ws)

    def remove_socket(self, ws: WebSocket) -> None:
        self._sockets.discard(ws)

    def get_state(self) -> dict[str, Any]:
        return {
            "type": "state",
            "phase": self.phase,
            "round_id": str(self.round_id),
            "multiplier": str(self.multiplier),
            "countdown": self.countdown_remaining,
            "active_bets_count": len(self.active_bets),
            "history": self.history[-10:],
        }

    def generate_next_crash_point(self, rtp: float = 0.98) -> Decimal:
        # Standard crash formula: crash = max(1.00, floor2(RTP / (1 - u)))
        u = secrets.randbelow(1000000) / 1000000.0
        if u >= 0.9999:
            u = 0.999
        val = rtp / (1.0 - u)
        val_floor = math_floor2(val)
        return Decimal(str(max(1.00, val_floor)))

    async def broadcast(self, message: dict[str, Any]) -> None:
        raw = json.dumps(message)
        dead: list[WebSocket] = []
        for ws in self._sockets:
            try:
                await ws.send_text(raw)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._sockets.discard(ws)


def math_floor2(val: float) -> float:
    return int(val * 100) / 100.0


crash_manager = CrashGameManager()
