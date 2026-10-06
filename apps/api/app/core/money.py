"""Para hesapları için tek doğruluk kaynağı.

Kurallar:
- Para asla float ile hesaplanmaz; her yerde Decimal kullanılır.
- Tutarlar kuruşa (2 hane) yuvarlanır, yuvarlama "half up" (0,005 -> 0,01).
- Kurlar 6 hane tutulur.
- Bölme işlemlerinde kuruş kaybolmaz: kalan kuruşlar sırayla dağıtılır.
"""

from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum

CENT = Decimal("0.01")
RATE_STEP = Decimal("0.000001")
ZERO = Decimal("0.00")


class Currency(StrEnum):
    TRY = "TRY"
    EUR = "EUR"
    GBP = "GBP"
    USD = "USD"


BASE_CURRENCY = Currency.TRY


def to_decimal(value: Decimal | int | str | float) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        # float'ın ikili gösterim hatasını taşımamak için metin üzerinden çevrilir.
        return Decimal(repr(value))
    return Decimal(value)


def money(value: Decimal | int | str | float) -> Decimal:
    """Tutarı kuruşa yuvarlar."""
    return to_decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def rate(value: Decimal | int | str | float) -> Decimal:
    """Kuru 6 haneye yuvarlar; kur sıfır veya negatif olamaz."""
    result = to_decimal(value).quantize(RATE_STEP, rounding=ROUND_HALF_UP)
    if result <= 0:
        raise ValueError("Kur sıfırdan büyük olmalıdır.")
    return result


def to_base(amount: Decimal, currency: Currency, exchange_rate: Decimal) -> Decimal:
    """Orijinal tutarı ana para birimine (TRY) çevirir. TRY işlemlerde kur 1 olmak zorundadır."""
    if currency == BASE_CURRENCY and exchange_rate != 1:
        raise ValueError("TRY işlemlerde kur 1 olmalıdır.")
    return money(amount * exchange_rate)


def vat_amount(net: Decimal, vat_rate_percent: Decimal) -> Decimal:
    """KDV hariç tutar üzerinden KDV'yi hesaplar."""
    return money(net * vat_rate_percent / Decimal(100))


def split_evenly(total: Decimal, parts: int) -> list[Decimal]:
    """Tutarı eşit parçalara böler; toplam her zaman orijinal tutara eşittir.

    Bölünemeyen kuruşlar ilk parçalardan başlayarak birer birer dağıtılır.
    Negatif tutarlarda (zarar) aynı kural işaret korunarak uygulanır.
    Örnek: 100,00 / 3 -> [33,34, 33,33, 33,33]
    """
    if parts <= 0:
        raise ValueError("Parça sayısı sıfırdan büyük olmalıdır.")
    total = money(total)
    sign = -1 if total < 0 else 1
    cents = int(abs(total) / CENT)
    base, remainder = divmod(cents, parts)
    result = []
    for index in range(parts):
        share_cents = base + (1 if index < remainder else 0)
        result.append(money(Decimal(sign * share_cents) * CENT))
    return result
