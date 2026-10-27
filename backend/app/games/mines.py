from __future__ import annotations

from decimal import Decimal
import math
import secrets


def binomial(n: int, k: int) -> int:
    if k < 0 or k > n:
        return 0
    return math.comb(n, k)


def calculate_mines_multiplier(mine_count: int, safe_picks: int) -> Decimal:
    """Calculate exact multiplier at step k floor2(98 * C(25, k) / C(25 - m, k)) / 100."""
    if safe_picks <= 0:
        return Decimal("1.00")
    safe_total = 25 - mine_count
    if safe_picks > safe_total:
        raise ValueError("Cannot pick more safe tiles than exist")

    num = 98 * binomial(25, safe_picks)
    denom = binomial(safe_total, safe_picks)
    mult_hundredths = num // denom
    return Decimal(mult_hundredths) / Decimal("100")


def generate_mine_positions(mine_count: int) -> list[int]:
    """Generate unique mine positions in [0..24] using Fisher-Yates shuffle with CSPRNG."""
    if not (1 <= mine_count <= 24):
        raise ValueError("mine_count must be between 1 and 24")

    pool = list(range(25))
    for i in range(mine_count):
        j = i + secrets.randbelow(25 - i)
        pool[i], pool[j] = pool[j], pool[i]
    return sorted(pool[:mine_count])
