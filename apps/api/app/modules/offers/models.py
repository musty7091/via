from datetime import date, datetime, time
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.money import Currency
from app.db.base import Base, RateColumn, TimestampMixin
from app.modules.catalog.models import ProgramSection
from app.modules.customers.models import Customer, CustomerContact, InvoicePreference, Venue
from app.modules.partners.models import Partner
from app.modules.users.models import User


class OfferStatus(StrEnum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    CONVERTED = "converted"  # anlaşmaya çevrildi; artık değiştirilemez


class LineType(StrEnum):
    PACKAGE = "package"  # paket başlığı: paketin tek satış fiyatı
    PACKAGE_COMPONENT = "package_component"  # paket içeriği: fiyatsız, "Dahil"
    ARTIST = "artist"
    SERVICE = "service"
    CUSTOM = "custom"


class Offer(TimestampMixin, Base):
    """Müşteriye verilen teklif.

    Satış fiyatlarının hepsi teklifin para biriminde (`currency`) tutulur.
    `exchange_rate`: teklif para biriminden TL'ye kur (TL tekliflerde 1).
    Toplamlar her değişiklikte yeniden hesaplanıp saklanır.
    """

    __tablename__ = "offers"

    id: Mapped[int] = mapped_column(primary_key=True)
    offer_no: Mapped[str] = mapped_column(String(30), unique=True)
    status: Mapped[OfferStatus] = mapped_column(String(20), default=OfferStatus.DRAFT, index=True)

    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    customer: Mapped[Customer] = relationship()
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("customer_contacts.id"))
    contact: Mapped[CustomerContact | None] = relationship()
    venue_id: Mapped[int | None] = mapped_column(ForeignKey("venues.id"))
    venue: Mapped[Venue | None] = relationship()
    # İşi getiren ortak (zorunlu iş kuralı)
    partner_id: Mapped[int] = mapped_column(ForeignKey("partners.id"))
    partner: Mapped[Partner] = relationship()

    title: Mapped[str] = mapped_column(String(200))
    event_date: Mapped[date | None] = mapped_column(Date)
    event_start: Mapped[time | None] = mapped_column(Time)
    event_end: Mapped[time | None] = mapped_column(Time)
    guest_count: Mapped[int | None]
    offer_date: Mapped[date] = mapped_column(Date)
    valid_until: Mapped[date] = mapped_column(Date)

    invoice_type: Mapped[InvoicePreference] = mapped_column(String(20))
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    currency: Mapped[Currency] = mapped_column(String(3))
    exchange_rate: Mapped[Decimal] = mapped_column(RateColumn, default=Decimal("1"))

    discount_amount: Mapped[Decimal] = mapped_column(default=Decimal("0"))
    advance_amount: Mapped[Decimal] = mapped_column(default=Decimal("0"))
    payment_terms: Mapped[str | None] = mapped_column(Text)
    customer_notes: Mapped[str | None] = mapped_column(Text)
    internal_notes: Mapped[str | None] = mapped_column(Text)

    # Hesaplanmış toplamlar (teklif para biriminde)
    subtotal: Mapped[Decimal] = mapped_column(default=Decimal("0"))
    net_amount: Mapped[Decimal] = mapped_column(default=Decimal("0"))
    vat_amount: Mapped[Decimal] = mapped_column(default=Decimal("0"))
    total_amount: Mapped[Decimal] = mapped_column(default=Decimal("0"))

    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status_note: Mapped[str | None] = mapped_column(Text)  # ret/iptal sebebi
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_by: Mapped[User | None] = relationship()
    search_text: Mapped[str] = mapped_column(Text, default="", index=True)

    lines: Mapped[list["OfferLine"]] = relationship(
        back_populates="offer",
        order_by=lambda: (OfferLine.sort_order, OfferLine.id),
        cascade="all, delete-orphan",
    )


class OfferLine(TimestampMixin, Base):
    __tablename__ = "offer_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    offer_id: Mapped[int] = mapped_column(ForeignKey("offers.id", ondelete="CASCADE"), index=True)
    offer: Mapped[Offer] = relationship(back_populates="lines")
    line_type: Mapped[LineType] = mapped_column(String(20))
    # Paket içeriği satırları, bağlı oldukları paket başlığını gösterir.
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("offer_lines.id", ondelete="CASCADE"))
    parent: Mapped["OfferLine | None"] = relationship(remote_side="OfferLine.id")

    package_id: Mapped[int | None] = mapped_column(ForeignKey("packages.id"))
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"))
    service_id: Mapped[int | None] = mapped_column(ForeignKey("service_items.id"))

    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    program_section: Mapped[ProgramSection | None] = mapped_column(String(20))
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("1"))

    unit_price: Mapped[Decimal] = mapped_column(default=Decimal("0"))  # teklif para biriminde
    unit_cost: Mapped[Decimal] = mapped_column(default=Decimal("0"))
    cost_currency: Mapped[Currency] = mapped_column(String(3), default=Currency.TRY)
    cost_rate: Mapped[Decimal] = mapped_column(RateColumn, default=Decimal("1"))  # maliyet → TL

    is_visible: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)
