from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import TimestampMixin


class Event(TimestampMixin, Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_code: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    venue_id: Mapped[int | None] = mapped_column(ForeignKey("venues.id"), nullable=True, index=True)
    responsible_partner_id: Mapped[int | None] = mapped_column(ForeignKey("partners.id"), nullable=True, index=True)
    operation_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    invoice_type: Mapped[str] = mapped_column(String(50), nullable=False, default="without_invoice")
    vat_rate: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False, default=16)
    agreement_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    agreement_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    exchange_rate: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=1)
    base_agreement_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    vat_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_customer_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_period_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class EventItem(TimestampMixin, Base):
    __tablename__ = "event_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    item_type: Mapped[str] = mapped_column(String(50), nullable=False)
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"), nullable=True, index=True)
    service_item_id: Mapped[int | None] = mapped_column(ForeignKey("service_items.id"), nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sale_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    sale_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    cost_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    cost_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    exchange_rate: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=1)
    base_sale_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    base_cost_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class EventProfitSnapshot(TimestampMixin, Base):
    __tablename__ = "event_profit_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    revenue_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    artist_cost_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    operation_expense_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    other_expense_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    net_profit_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    partner_share_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    calculated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)