"""
VIA EVENTS — Para (Decimal) yardımcıları.

Tüm parasal hesaplamalar bu modül üzerinden Decimal ile yapılır.
Amaç: float kayan nokta hatalarını ve bankacı yuvarlamasını (ROUND_HALF_EVEN)
ortadan kaldırmak; muhasebe standardı olan ROUND_HALF_UP ile çalışmak.

Kullanım kuralı:
- Bir tutarı hesaba katmadan önce `D(value)` ile Decimal'e çevir.
- Saklamadan / döndürmeden önce `money(value)` ile 4 haneye yuvarla
  (veritabanı ölçeği Numeric(18, 4)).
- Tutarları toplarken `money_sum(...)` kullan.
- Para birimi çevirirken `convert(amount, rate)` kullan.

Not: API çıktısında değerler JSON sayı (float) olarak gider; bu zorunludur
çünkü tarayıcı (JavaScript) ondalıkları float tutar. Değer bu noktaya gelene
kadar Decimal ile doğru hesaplandığı için float gösterimi kuruşuna kadar doğrudur.
"""

from __future__ import annotations

from collections.abc import Iterable
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Annotated

from pydantic import BeforeValidator, PlainSerializer

# Veritabanı para ölçeği: Numeric(18, 4)
MONEY_QUANT = Decimal("0.0001")
# Kur ölçeği: Numeric(18, 6)
RATE_QUANT = Decimal("0.000001")
# Gösterim için 2 hane (gerekirse)
TWO_PLACES = Decimal("0.01")

ZERO = Decimal("0")


def D(value: object) -> Decimal:
    """Herhangi bir değeri güvenli şekilde Decimal'e çevirir.

    - None -> 0
    - float -> str üzerinden çevrilir (binary float artefaktını engellemek için)
    - Decimal -> aynen
    """
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        # str(float) ile en yakın kısa ondalık gösterim alınır (1234.56 vb.)
        return Decimal(str(value))
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return ZERO


def money(value: object, quant: Decimal = MONEY_QUANT) -> Decimal:
    """Tutarı para ölçeğine (varsayılan 4 hane) ROUND_HALF_UP ile yuvarlar."""
    return D(value).quantize(quant, rounding=ROUND_HALF_UP)


def money2(value: object) -> Decimal:
    """Tutarı 2 haneye ROUND_HALF_UP ile yuvarlar."""
    return D(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def rate(value: object) -> Decimal:
    """Kuru kur ölçeğine (6 hane) yuvarlar."""
    return D(value).quantize(RATE_QUANT, rounding=ROUND_HALF_UP)


def money_sum(values: Iterable[object]) -> Decimal:
    """Bir dizi tutarı Decimal ile toplar ve para ölçeğine yuvarlar."""
    total = ZERO
    for value in values:
        total += D(value)
    return money(total)


def convert(amount: object, exchange_rate: object) -> Decimal:
    """Tutarı kur ile ana para birimine çevirir (4 haneye yuvarlanmış Decimal)."""
    return money(D(amount) * D(exchange_rate))


def percent_of(amount: object, percent: object) -> Decimal:
    """Bir tutarın yüzde payını hesaplar (ör. KDV, ortak payı)."""
    return money(D(amount) * D(percent) / Decimal("100"))


def is_zero(value: object, tolerance: Decimal = MONEY_QUANT) -> bool:
    """Tutar (yuvarlama toleransı içinde) sıfır mı?"""
    return abs(D(value)) <= tolerance


def is_positive(value: object, tolerance: Decimal = MONEY_QUANT) -> bool:
    """Tutar anlamlı şekilde pozitif mi?"""
    return D(value) > tolerance


# --- Pydantic için para tipi -------------------------------------------------
# Para alanları içeride Decimal taşır (kayıpsız), JSON'a ise SAYI (number) olarak
# yazılır; böylece ön yüz string değil sayı alır. Girişte float gelse bile str
# üzerinden Decimal'e çevrilerek binary float artefaktı engellenir.

def _coerce_money(value: object) -> object:
    if value is None or isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money_to_number(value: object):
    if value is None:
        return None
    return float(value)


Money = Annotated[
    Decimal,
    BeforeValidator(_coerce_money),
    PlainSerializer(_money_to_number, return_type=float, when_used="json"),
]

OptMoney = Annotated[
    Decimal | None,
    BeforeValidator(_coerce_money),
    PlainSerializer(_money_to_number, return_type=float | None, when_used="json"),
]
