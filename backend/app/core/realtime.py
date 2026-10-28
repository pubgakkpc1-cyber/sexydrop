from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from decimal import Decimal
import json
from typing import Any, Literal
import uuid

from starlette.websockets import WebSocket

from app.core.db import get_session_factory
from app.games.crash import generate_crash_point
from app.services.crash_service import (
    cashout_crash_bet,
    finish_crash_bet_lost,
    place_crash_bet,
)


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


class CrashGameError(Exception):
    pass


class CrashGameManager:
    """Server-authoritative real-time Crash cycle.

    The manager runs a shared round state machine (betting -> flying -> crashed)
    and persists every bet/cashout atomically through the ledger. The game
    outcome (crash point) is drawn with CSPRNG on the server and never sent to
    clients before the round ends; clients only observe the shared multiplier.
    """

    def __init__(self) -> None:
        self.phase: Literal["betting", "flying", "crashed"] = "betting"
        self.round_id: str = str(uuid.uuid4())
        self.multiplier: Decimal = Decimal("1.00")
        self.crash_point: Decimal = Decimal("1.50")
        self.countdown_remaining: float = float(BETTING_WINDOW_S)
        self.active_bets: dict[uuid.UUID, dict[str, Any]] = {}
        self.history: list[dict[str, Any]] = []
        self._sockets: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._task: asyncio.Task[None] | None = None
        self.flying_elapsed_ms: int = 0

    # --- socket management -------------------------------------------------

    def add_socket(self, ws: WebSocket) -> None:
        self._sockets.add(ws)

    def remove_socket(self, ws: WebSocket) -> None:
        self._sockets.discard(ws)

    async def broadcast(self, message: dict[str, Any]) -> None:
        raw = json.dumps(message, ensure_ascii=False)
        dead: list[WebSocket] = []
        for ws in self._sockets:
            try:
                await ws.send_text(raw)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._sockets.discard(ws)

    # --- public state ------------------------------------------------------

    def get_state(self) -> dict[str, Any]:
        return {
            "type": "state",
            "phase": self.phase,
            "round_id": self.round_id,
            "multiplier": str(self.multiplier),
            "crash_point": None if self.phase != "crashed" else str(self.crash_point),
            "countdown": round(self.countdown_remaining, 1),
            "active_bets_count": len(self.active_bets),
            "history": self.history[-10:],
        }

    def get_user_state(self, user_id: uuid.UUID) -> dict[str, Any]:
        bet = self.active_bets.get(user_id)
        return {
            "type": "my_state",
            "phase": self.phase,
            "round_id": self.round_id,
            "multiplier": str(self.multiplier),
            "countdown": round(self.countdown_remaining, 1),
            "bet": (
                {
                    "bet_gram": str(bet["bet_gram"]),
                    "cashed_out": bet.get("cashed_out", False),
                    "cashout_multiplier": (
                        str(bet["cashout_multiplier"]) if bet.get("cashed_out") else None
                    ),
                }
                if bet
                else None
            ),
        }

    # --- lifecycle ---------------------------------------------------------

    def start(self) -> asyncio.Task[None]:
        if self._task is None:
            self._task = asyncio.create_task(self._run_loop())
        return self._task

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run_loop(self) -> None:
        while True:
            try:
                await self.step()
            except asyncio.CancelledError:
                raise
            except Exception:
                # The loop must survive isolated failures (e.g. a flaky DB write).
                pass
            await asyncio.sleep(CRASH_TICK_MS / 1000.0)

    async def step(self) -> None:
        """Advance the round by exactly one tick. Testable without the loop."""
        async with self._lock:
            if self.phase == "betting":
                self.countdown_remaining -= CRASH_TICK_MS / 1000.0
                if self.countdown_remaining <= 0:
                    await self._start_round()
                return
            if self.phase == "flying":
                await self._advance_flight()
                return
            # crashed: brief dwell, then a fresh betting round
            await self._reset_round()

    async def _start_round(self) -> None:
        self.phase = "flying"
        self.multiplier = Decimal("1.00")
        self.crash_point = generate_crash_point()
        self.flying_elapsed_ms = 0

    async def _advance_flight(self) -> None:
        self.flying_elapsed_ms += CRASH_TICK_MS
        growth = 1.0 + CRASH_GROWTH_PER_SEC * (CRASH_TICK_MS / 1000.0)
        next_mult = self.multiplier * Decimal(str(growth))
        if next_mult >= self.crash_point:
            await self._crash()
            return
        self.multiplier = next_mult
        # Auto-cashout at or above the target multiplier.
        for user_id in list(self.active_bets):
            bet = self.active_bets[user_id]
            if bet.get("auto_cashout") is not None and not bet.get("cashed_out"):
                if self.multiplier >= bet["auto_cashout"]:
                    await self._do_cashout(user_id)

    async def _crash(self) -> None:
        self.multiplier = self.crash_point
        self.phase = "crashed"
        await self._finalize_round()

    async def _finalize_round(self) -> None:
        """Persist outcomes for bets that were not cashed out (their stake already debited)."""
        crash_mult = self.crash_point
        async with get_session_factory()() as session:
            for user_id, bet in list(self.active_bets.items()):
                if bet.get("cashed_out"):
                    continue
                try:
                    await finish_crash_bet_lost(
                        session,
                        user_id=user_id,
                        crash_multiplier=crash_mult,
                        server_round_id=self.round_id,
                    )
                except Exception:
                    await session.rollback()
        # active_bets are NOT cleared here: during the "crashed" phase clients
        # still need my_state to show their lost bet. They clear on _reset_round.
        self.crash_point = Decimal("1.50")

    async def _reset_round(self) -> None:
        self.phase = "betting"
        self.round_id = str(uuid.uuid4())
        self.multiplier = Decimal("1.00")
        self.countdown_remaining = float(BETTING_WINDOW_S)
        self.flying_elapsed_ms = 0

    # --- player actions ----------------------------------------------------

    async def place_bet(
        self,
        *,
        user_id: uuid.UUID,
        bet_gram: Decimal,
        client_request_id: str | None = None,
        auto_cashout: Decimal | None = None,
    ) -> dict[str, Any]:
        async with self._lock:
            if user_id in self.active_bets:
                raise CrashGameError("You already have a bet in this round")
            if self.phase != "betting":
                raise CrashGameError("Round is not accepting bets right now")

            async with get_session_factory()() as session:
                try:
                    game_round, new_balance = await place_crash_bet(
                        session,
                        user_id=user_id,
                        bet_gram=bet_gram,
                        server_round_id=self.round_id,
                        client_request_id=client_request_id,
                    )
                except Exception as exc:
                    await session.rollback()
                    raise CrashGameError(str(exc)) from exc

            self.active_bets[user_id] = {
                "server_round_id": game_round.id,
                "bet_gram": bet_gram,
                "client_request_id": client_request_id,
                "auto_cashout": auto_cashout,
                "cashed_out": False,
                "cashout_multiplier": None,
            }
            return {
                "type": "bet_accepted",
                "round_id": self.round_id,
                "bet_gram": str(bet_gram),
                "new_balance_gram": str(new_balance),
            }

    async def cashout(self, *, user_id: uuid.UUID) -> dict[str, Any]:
        async with self._lock:
            return await self._do_cashout(user_id)

    async def _do_cashout(self, user_id: uuid.UUID) -> dict[str, Any]:
        bet = self.active_bets.get(user_id)
        if bet is None:
            raise CrashGameError("You have no active bet in this round")
        if self.phase != "flying":
            raise CrashGameError("Can only cash out while the rocket is flying")
        if bet.get("cashed_out"):
            raise CrashGameError("Bet already cashed out")
        mult = self.multiplier
        if mult < Decimal("1.00"):
            raise CrashGameError("Cannot cash out below 1.00")

        async with get_session_factory()() as session:
            try:
                _game_round, new_balance = await cashout_crash_bet(
                    session,
                    user_id=user_id,
                    server_round_id=self.round_id,
                    multiplier=mult,
                )
            except Exception:
                await session.rollback()
                raise

        win_mult = mult
        bet["cashed_out"] = True
        bet["cashout_multiplier"] = win_mult
        return {
            "type": "cashout_done",
            "round_id": self.round_id,
            "multiplier": str(win_mult),
            "new_balance_gram": str(new_balance),
        }


# --- module-level constants and singleton -----------------------------------

CRASH_TICK_MS = 100
BETTING_WINDOW_S = 5.0
CRASH_GROWTH_PER_SEC = 0.9

crash_manager = CrashGameManager()
