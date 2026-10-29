from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_admin_give_ton_unauthorized() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # No credentials or header
        resp = await client.post(
            "/api/admin/give-ton",
            json={"username": "someone", "amount_ton": "10.000"},
        )
        assert resp.status_code == 403
        assert "zapixxgarant" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_admin_list_users_unauthorized() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/admin/users")
        assert resp.status_code == 403
