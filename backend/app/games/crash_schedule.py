"""Расписание раундов Ракетки на сервере.

Раунды идут цепочкой внутри 10-минутных окон, выровненных по UTC (та же структура, что у клиента):
окно ставок 5 с → полёт (по тикам по 50 мс) → показ результата 3 с. Точка краша каждого раунда —
HMAC от серверного секрета, поэтому заранее её не знает никто, включая клиентский код.
Точка краша раскрывается клиенту только после краша.
"""

from __future__ import annotations

import hashlib
import hmac
import math
from dataclasses import dataclass
from functools import lru_cache

CRASH_RTP = 0.98
TICK_MS = 50
BETTING_MS = 5000
CRASHED_MS = 3000
WINDOW_MS = 10 * 60 * 1000
MAX_CRASH = 500.0
_MAX_FLIGHT_TICKS = 4800


def _floor2(x: float) -> float:
    return math.floor(x * 100) / 100


def _growth_for(mult: float) -> float:
    if mult < 2.0:
        return math.exp(math.log(2) * (TICK_MS / 6500))
    ratio = mult / 2.0
    doubling_ms = max(1100.0, 6500 / math.pow(ratio, 0.45))
    return math.exp(math.log(2) * (TICK_MS / doubling_ms))


def crash_point_for_round(round_id: int, secret: bytes) -> float:
    digest = hmac.new(secret, f"crash:{round_id}".encode(), hashlib.sha256).digest()
    u = int.from_bytes(digest[:7], "big") / float(1 << 56)
    return min(MAX_CRASH, max(1.0, _floor2(CRASH_RTP / (1 - u))))


@dataclass(frozen=True)
class RoundInfo:
    id: int
    crash_point: float
    curve: tuple[float, ...]  # показанный множитель на каждом тике полёта, последний = точка краша
    duration_ms: int


@lru_cache(maxsize=512)
def _curve_for(crash_point: float) -> tuple[float, ...]:
    curve: list[float] = []
    acc = 1.0
    for _ in range(_MAX_FLIGHT_TICKS):
        acc *= _growth_for(acc)
        shown = _floor2(acc)
        if shown >= crash_point:
            curve.append(crash_point)
            break
        curve.append(shown)
    return tuple(curve)


class Schedule:
    def __init__(self, secret: bytes) -> None:
        self._secret = secret
        self._cache: dict[int, RoundInfo] = {}

    def round_info(self, round_id: int) -> RoundInfo:
        cached = self._cache.get(round_id)
        if cached is not None:
            return cached
        crash_point = crash_point_for_round(round_id, self._secret)
        curve = _curve_for(crash_point)
        info = RoundInfo(
            id=round_id,
            crash_point=crash_point,
            curve=curve,
            duration_ms=BETTING_MS + len(curve) * TICK_MS + CRASHED_MS,
        )
        if len(self._cache) > 400:
            self._cache.clear()
        self._cache[round_id] = info
        return info

    def _round_start(self, round_id: int) -> int:
        """Абсолютное время начала раунда (мс UTC)."""
        w, k = divmod(round_id, 1000)
        start = w * WINDOW_MS
        for i in range(k):
            start += self.round_info(w * 1000 + i).duration_ms
        return start

    def at(self, now_ms: int) -> dict:
        """Состояние на момент now_ms: round_id, phase (betting|flying|crashed), multiplier, crash_point (после краша)."""
        w = now_ms // WINDOW_MS
        t = now_ms - w * WINDOW_MS
        acc = 0
        k = 0
        while True:
            info = self.round_info(w * 1000 + k)
            if acc + info.duration_ms > WINDOW_MS and k > 0:
                prev = self.round_info(w * 1000 + k - 1)
                return self._state(prev, now_ms, "crashed", prev.crash_point, w * WINDOW_MS + acc - prev.duration_ms)
            if t < info.duration_ms:
                start = w * WINDOW_MS + acc
                if t < BETTING_MS:
                    return self._state(info, now_ms, "betting", 1.0, start)
                flight_ms = len(info.curve) * TICK_MS
                ft = t - BETTING_MS
                if ft < flight_ms:
                    idx = min(len(info.curve) - 1, ft // TICK_MS)
                    return self._state(info, now_ms, "flying", info.curve[idx], start)
                return self._state(info, now_ms, "crashed", info.crash_point, start)
            t -= info.duration_ms
            acc += info.duration_ms
            k += 1

    @staticmethod
    def _state(info: RoundInfo, now_ms: int, phase: str, mult: float, start_ms: int) -> dict:
        return {
            "round_id": info.id,
            "phase": phase,
            "multiplier": mult,
            # точка краша раскрывается только после краша
            "crash_point": info.crash_point if phase == "crashed" else None,
            "round_start_ms": start_ms,
            "flight_start_ms": start_ms + BETTING_MS,
            "server_now_ms": now_ms,
        }

    def recent_crash_points(self, now_ms: int, count: int) -> list[float]:
        out: list[float] = []
        cur = self.at(now_ms)
        w, k = divmod(cur["round_id"], 1000)
        last_done = k if cur["phase"] == "crashed" else k - 1
        for i in range(last_done, -1, -1):
            if len(out) >= count:
                break
            out.append(self.round_info(w * 1000 + i).crash_point)
        wi = w - 1
        while len(out) < count and wi > w - 4:
            ids: list[int] = []
            acc = 0
            i = 0
            while True:
                info = self.round_info(wi * 1000 + i)
                if acc + info.duration_ms > WINDOW_MS and i > 0:
                    break
                ids.append(info.id)
                acc += info.duration_ms
                i += 1
            for rid in reversed(ids):
                if len(out) >= count:
                    break
                out.append(self.round_info(rid).crash_point)
            wi -= 1
        return out

    def resolved(self, round_id: int, now_ms: int) -> RoundInfo | None:
        """Раунд, у которого точка краша уже наступила к моменту now_ms (иначе None)."""
        cur = self.at(now_ms)
        if round_id < cur["round_id"] or (round_id == cur["round_id"] and cur["phase"] == "crashed"):
            return self.round_info(round_id)
        return None
