from decimal import Decimal

import pytest

from app.core.money import Currency, money, rate, split_evenly, to_base, vat_amount


def test_money_rounds_half_up_to_kurus():
    assert money("10.005") == Decimal("10.01")
    assert money("10.004") == Decimal("10.00")
    assert money(0.1 + 0.2) == Decimal("0.30")


@pytest.mark.parametrize(
    ("total", "expected"),
    [
        ("100.00", ["33.34", "33.33", "33.33"]),
        ("300000.00", ["100000.00", "100000.00", "100000.00"]),
        ("0.02", ["0.01", "0.01", "0.00"]),
        ("-100.00", ["-33.34", "-33.33", "-33.33"]),
    ],
)
def test_split_evenly_never_loses_a_kurus(total, expected):
    shares = split_evenly(Decimal(total), 3)

    assert shares == [Decimal(value) for value in expected]
    assert sum(shares) == Decimal(total)


def test_to_base_converts_foreign_currency():
    assert to_base(Decimal("1000.00"), Currency.EUR, rate("36.452100")) == Decimal("36452.10")


def test_to_base_rejects_rate_other_than_one_for_try():
    with pytest.raises(ValueError):
        to_base(Decimal("100.00"), Currency.TRY, Decimal("2"))


def test_rate_must_be_positive():
    with pytest.raises(ValueError):
        rate("0")


def test_vat_amount_uses_kktc_rate():
    assert vat_amount(Decimal("300000.00"), Decimal("16")) == Decimal("48000.00")
