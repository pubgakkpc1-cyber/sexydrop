from __future__ import annotations

import asyncio
from decimal import Decimal
import json

import pytest
from httpx import AsyncClient
from starlette.testclient import TestClient

from app.core.realtime import broadcaster
from app.main import app


def test_crash_websocket_connection() -> None:
    client = TestClient(app)
    with client.websocket_connect("/api/ws/crash") as ws:
        # 1. On connection receive initial state
        data = ws.receive_json()
        assert data["type"] == "state"
        assert "round_id" in data
        assert "multiplier" in data

        # 2. Ping-pong
        ws.send_json({"action": "ping"})
        pong = ws.receive_json()
        assert pong["type"] == "pong"

        # 3. Request current state
        ws.send_json({"action": "get_state"})
        st = ws.receive_json()
        assert st["type"] == "state"


async def test_live_drops_broadcaster_queue() -> None:
    q = broadcaster.subscribe()
    try:
        assert q.empty()

        await broadcaster.broadcast_drop(
            user_name="Pavel",
            gift_id="plush-pepe",
            gift_name="Plush Pepe",
            rarity="legendary",
            image_url="/gifts/plush-pepe.svg",
            case_id="pepe",
            price_gram=Decimal("25.000"),
        )

        assert not q.empty()
        raw_msg = await q.get()
        assert "data: " in raw_msg
        payload = json.loads(raw_msg.replace("data: ", "").strip())
        assert payload["type"] == "drop"
        assert payload["user_name"] == "Pavel"
        assert payload["gift_id"] == "plush-pepe"
        assert payload["rarity"] == "legendary"
        assert payload["price_gram"] == "25.000"
    finally:
        broadcaster.unsubscribe(q)


async def test_trigger_broadcast_drop_api(client: AsyncClient) -> None:
    q = broadcaster.subscribe()
    try:
        resp = await client.post(
            "/api/realtime/broadcast-drop",
            json={
                "user_name": "Alice",
                "gift_id": "heart-locket",
                "gift_name": "Heart Locket",
                "rarity": "rare",
                "image_url": "/gifts/heart-locket.svg",
                "case_id": "farm",
                "price_gram": "1.000",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "broadcasted"

        raw = await q.get()
        payload = json.loads(raw.replace("data: ", "").strip())
        assert payload["user_name"] == "Alice"
        assert payload["gift_name"] == "Heart Locket"
    finally:
        broadcaster.unsubscribe(q)
