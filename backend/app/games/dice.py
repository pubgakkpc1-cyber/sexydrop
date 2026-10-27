from __future__ import annotations

from decimal import Decimal
import math
import secrets
from typing import Literal

RTP_PCT = 98  # 0.98


def validate_dice_target(target: int, direction: Literal["over", "under"]) -> None:
    if direction == "over":
        if not (199 <= target <= 9899):
            raise ValueError(f"For 'over', target must be between 199 and 9899 (got {target})")
    elif direction == "under":
        if not (100 <= target <= 9800):
            raise ValueError(f"For 'under', target must be between 100 and 9800 (got {target})")
    else:
        raise ValueError(f"Invalid direction: {direction}")


def calculate_dice_multiplier(target: int, direction: Literal["over", "under"]) -> Decimal:
    validate_dice_target(target, direction)
    c = (9999 - target) if direction == "over" else target
    # Floor to 4 decimal places (in millionths)
    m4 = (RTP_PCT * 1_000_000) // c
    return Decimal(m4) / Decimal("10000")


def evaluate_dice_roll(
    target: int,
    direction: Literal["over", "under"],
    roll: int,
) -> bool:
    if direction == "over":
        return roll > target
    return roll < target


def roll_dice() -> int:
    """Generate roll in [0, 9999] using CSPRNG."""
    return secrets.randbelow(10000)
