from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlalchemy import inspect

from app.core.money import Currency


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page[T](BaseModel):
    items: list[T]
    total: int


# Ortak alan tipleri: tüm modüller aynı kuralları kullanır.
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)]

# Para: negatif olamaz, kuruştan fazla hane olamaz.
Amount = Annotated[Decimal, Field(ge=0, max_digits=16, decimal_places=2)]
Quantity = Annotated[Decimal, Field(gt=0, max_digits=10, decimal_places=2)]


class MoneyValue(ApiModel):
    amount: Decimal
    currency: Currency


def blank_to_none(value: object) -> object:
    """Formlardan gelen boş metinleri None yapar."""
    return None if isinstance(value, str) and not value.strip() else value


def columns(obj: object) -> dict[str, object]:
    """Bir veritabanı kaydının tüm kolon değerleri (yüklenmemiş olanlar da okunur)."""
    return {attr.key: getattr(obj, attr.key) for attr in inspect(obj).mapper.column_attrs}
