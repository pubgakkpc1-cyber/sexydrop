"""GRAM amounts for PostgreSQL NUMERIC(20, 3).

1 GRAM = 1000 minor units (same scale as the frontend). Application code
converts through Decimal; the database stores majors with milligram precision.
Rounding is always down (house edge), never float.
"""

from decimal import ROUND_DOWN, Decimal

MINOR_PER_MAJOR = 1000
GRAM_QUANT = Decimal("0.001")
GRAM_NUMERIC_PRECISION = 20
GRAM_NUMERIC_SCALE = 3


def minor_to_gram(minor: int) -> Decimal:
    if not isinstance(minor, int) or isinstance(minor, bool):
        raise TypeError(f"minor must be int, got {type(minor)!r}")
    if minor < 0:
        raise ValueError(f"negative amounts are not allowed: {minor}")
    return (Decimal(minor) / MINOR_PER_MAJOR).quantize(GRAM_QUANT, rounding=ROUND_DOWN)


def gram_to_minor(amount: Decimal | str | int) -> int:
    value = amount if isinstance(amount, Decimal) else Decimal(str(amount))
    if value < 0:
        raise ValueError(f"negative amounts are not allowed: {value}")
    scaled = (value * MINOR_PER_MAJOR).to_integral_value(rounding=ROUND_DOWN)
    return int(scaled)
