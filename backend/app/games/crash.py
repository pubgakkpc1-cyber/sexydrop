from __future__ import annotations

from decimal import Decimal
import secrets

# House edge / RTP for the crash curve. The pure "RTP/(1-u)" distribution has
# RTP = 1.0 by construction; we scale the numerator down to 0.98 so the house
# keeps a 2% edge (same RTP_FACTOR used across all games).
CRASH_RTP = Decimal("0.98")

# Upper safety bound on crash points. With RTP = 0.98 the theoretical maximum
# grows unbounded as u -> 1, so we clamp the uniform sample to keep payouts
# bounded and match the documented frontend behaviour.
MAX_U = Decimal("0.9999")


def crash_floor2(value: Decimal) -> Decimal:
    """Floor a multiplier to 2 decimal places (in favour of the house)."""
    return (value * 100).to_integral_value(rounding="ROUND_DOWN") / 100


def generate_crash_point(rtp: Decimal = CRASH_RTP) -> Decimal:
    """Draw the server-side crash point using CSPRNG.

    crash = max(1.00, floor2(rtp / (1 - u))),  u ~ Uniform[0, 1).
    Lower u means earlier crash; the result is never revealed to clients
    before the round ends.
    """
    u = Decimal(secrets.randbelow(1_000_000)) / Decimal(1_000_000)
    if u >= MAX_U:
        u = MAX_U - Decimal("0.000001")
    if u >= Decimal("1.000000"):  # defensive: keep denominator positive
        u = Decimal("0.999999")
    value = rtp / (Decimal("1.000000") - u)
    return max(Decimal("1.00"), crash_floor2(value))
