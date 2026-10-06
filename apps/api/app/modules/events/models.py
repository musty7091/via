from datetime import date, datetime, time
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.money import Currency
from app.db.base import Base, RateColumn, TimestampMixin
from app.modules.catalog.models import ProgramSection
from app.modules.customers.models import Customer, CustomerContact, InvoicePreference, Venue
from app.modules.offers.models import LineType, Offer
from app.modules.partners.models import Partner


class EventStatus(StrEnum):
    PLANNED = "planned"  # anlaşma yapıldı, etkinlik bekleniyor
    COMPLETED = "completed"  # etkinlik gerçekleşti
    CANCELLED = "cancelled"


class Event(TimestampMixin, Base):
    """Anlaşma sonucu açılan etkinlik dosyası.

    Tutarlar anlaşma anında tekliften DONDURULUR; kur dahil. Sonradan fiyat
    değişikliği ancak ek protokol ile yapılabilir (ileriki aşama).
    """

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_no: Mapped[str] = mapped_column(String(30), unique=True)
    status: Mapped[EventStatus] = mapped_column(String(20), default=EventStatus.PLANNED, index=True)
    offer_id: Mapped[int] = mapped_column(ForeignKey("offers.id"), unique=True)
    offer: Mapped[Offer] = relationship()

    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    customer: Mapped[Customer] = relationship()
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("customer_contacts.id"))
    contact: Mapped[CustomerContact | None] = relationship()
    venue_id: Mapped[int | None] = mapped_column(ForeignKey("venues.id"))
    venue: Mapped[Venue | None] = relationship()
    partner_id: Mapped[int] = mapped_column(ForeignKey("partners.id"), index=True)
    partner: Mapped[Partner] = relationship()

    title: Mapped[str] = mapped_column(String(200))
    event_date: Mapped[date] = mapped_column(Date, index=True)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    guest_count: Mapped[int | None]

    # Dondurulmuş anlaşma tutarları (teklif para biriminde)
    invoice_type: Mapped[InvoicePreference] = mapped_column(String(20))
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    currency: Mapped[Currency] = mapped_column(String(3))
    exchange_rate: Mapped[Decimal] = mapped_column(RateColumn)
    net_amount: Mapped[Decimal]
    vat_amount: Mapped[Decimal]
    total_amount: Mapped[Decimal]
    advance_amount: Mapped[Decimal]
    # TL karşılıkları (anlaşma kuruyla)
    base_net_amount: Mapped[Decimal]
    base_total_amount: Mapped[Decimal]

    payment_terms: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    agreed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_reason: Mapped[str | None] = mapped_column(Text)
    search_text: Mapped[str] = mapped_column(Text, default="", index=True)

    items: Mapped[list["EventItem"]] = relationship(
        back_populates="event",
        order_by=lambda: (EventItem.sort_order, EventItem.id),
        cascade="all, delete-orphan",
    )


class EventItem(TimestampMixin, Base):
    """Anlaşmadaki program/maliyet kalemi (teklif satırının kopyası).

    Sanatçı ve hizmet kalemlerinin maliyeti, finans aşamasında ödenecek
    borçların (sanatçı/tedarikçi) kaynağı olacaktır.
    """

    __tablename__ = "event_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    event: Mapped[Event] = relationship(back_populates="items")
    line_type: Mapped[LineType] = mapped_column(String(20))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("event_items.id", ondelete="CASCADE"))
    parent: Mapped["EventItem | None"] = relationship(remote_side="EventItem.id")
    package_id: Mapped[int | None] = mapped_column(ForeignKey("packages.id"))
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"))
    service_id: Mapped[int | None] = mapped_column(ForeignKey("service_items.id"))

    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    program_section: Mapped[ProgramSection | None] = mapped_column(String(20))
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    unit_price: Mapped[Decimal]
    unit_cost: Mapped[Decimal]
    cost_currency: Mapped[Currency] = mapped_column(String(3))
    cost_rate: Mapped[Decimal] = mapped_column(RateColumn)
    is_visible: Mapped[bool]
    sort_order: Mapped[int]
