from __future__ import annotations

from decimal import Decimal

import pytest

from app.core.money import gram_to_minor, minor_to_gram


def test_minor_to_gram_uses_three_decimals() -> None:
    assert minor_to_gram(1000) == Decimal("1.000")
    assert minor_to_gram(7770) == Decimal("7.770")
    assert minor_to_gram(9) == Decimal("0.009")
    assert minor_to_gram(0) == Decimal("0.000")


def test_gram_to_minor_rounds_down() -> None:
    assert gram_to_minor(Decimal("1")) == 1000
    assert gram_to_minor("7.77") == 7770
    assert gram_to_minor("0.0099") == 9


def test_rejects_negative_amounts() -> None:
    with pytest.raises(ValueError):
        minor_to_gram(-1)
    with pytest.raises(ValueError):
        gram_to_minor("-0.001")
