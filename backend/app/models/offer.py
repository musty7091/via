from datetime import date, time

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import TimestampMixin


class Offer(TimestampMixin, Base):
    __tablename__ = "offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), nullable=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    venue_id: Mapped[int | None] = mapped_column(ForeignKey("venues.id"), nullable=True, index=True)
    package_id: Mapped[int | None] = mapped_column(ForeignKey("service_packages.id"), nullable=True, index=True)

    offer_no: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Teklif")
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")

    offer_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)

    invoice_type: Mapped[str] = mapped_column(String(50), nullable=False, default="without_invoice")
    vat_rate: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False, default=16)

    amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    exchange_rate: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=1)
    base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    vat_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    advance_payment_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    advance_payment_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    payment_terms: Mapped[str | None] = mapped_column(Text, nullable=True)

    customer_visible_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    agreement_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class OfferItem(TimestampMixin, Base):
    __tablename__ = "offer_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    offer_id: Mapped[int] = mapped_column(ForeignKey("offers.id"), nullable=False, index=True)

    source_type: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")
    source_package_item_id: Mapped[int | None] = mapped_column(ForeignKey("service_package_items.id"), nullable=True, index=True)
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"), nullable=True, index=True)
    service_item_id: Mapped[int | None] = mapped_column(ForeignKey("service_items.id"), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Hizmet")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    program_section: Mapped[str | None] = mapped_column(String(100), nullable=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    internal_unit_cost: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    internal_cost_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    internal_total_cost: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    is_visible_on_offer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
