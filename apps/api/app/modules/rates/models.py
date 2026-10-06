from datetime import date
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.money import Currency
from app.db.base import Base, RateColumn, TimestampMixin


class RateSource(StrEnum):
    TCMB = "tcmb"  # TCMB döviz satış kuru (bülten tarihi)
    MANUAL = "manual"  # Elle girilen; aynı gün için TCMB'nin üzerine yazılmaz


class ExchangeRate(TimestampMixin, Base):
    """Günlük döviz kuru (1 birim = ? TL). Formlarda öneri olarak kullanılır;
    kayıtlar kendi kurunu saklar, bu tablo değişse de eski kayıtlar değişmez."""

    __tablename__ = "exchange_rates"
    __table_args__ = (UniqueConstraint("day", "currency"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    currency: Mapped[Currency] = mapped_column(String(3))
    rate: Mapped[Decimal] = mapped_column(RateColumn)
    source: Mapped[RateSource] = mapped_column(String(10))
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
