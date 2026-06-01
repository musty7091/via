from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import TimestampMixin


class Offer(TimestampMixin, Base):
    __tablename__ = "offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), nullable=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    offer_no: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    invoice_type: Mapped[str] = mapped_column(String(50), nullable=False, default="without_invoice")
    vat_rate: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False, default=16)
    amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    exchange_rate: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=1)
    base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    vat_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class OfferItem(TimestampMixin, Base):
    __tablename__ = "offer_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    offer_id: Mapped[int] = mapped_column(ForeignKey("offers.id"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)