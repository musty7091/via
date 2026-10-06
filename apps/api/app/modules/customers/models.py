from enum import StrEnum

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.money import Currency
from app.db.base import Base, TimestampMixin


class CustomerType(StrEnum):
    COMPANY = "company"
    HOTEL = "hotel"
    RESTAURANT = "restaurant"
    VENUE = "venue"
    ORGANIZER = "organizer"
    AGENCY = "agency"
    PUBLIC = "public"
    INDIVIDUAL = "individual"
    OTHER = "other"


class InvoicePreference(StrEnum):
    WITH_INVOICE = "with_invoice"
    WITHOUT_INVOICE = "without_invoice"


class RiskLevel(StrEnum):
    NORMAL = "normal"
    WATCH = "watch"
    BLOCKED = "blocked"  # yeni teklif verilemez


class VenueType(StrEnum):
    HOTEL = "hotel"
    RESTAURANT = "restaurant"
    HALL = "hall"
    BEACH = "beach"
    OPEN_AIR = "open_air"
    CLUB = "club"
    OTHER = "other"


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_type: Mapped[CustomerType] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(160))
    short_name: Mapped[str | None] = mapped_column(String(80))
    tax_number: Mapped[str | None] = mapped_column(String(40))
    tax_office: Mapped[str | None] = mapped_column(String(80))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(254))
    city: Mapped[str | None] = mapped_column(String(80))
    district: Mapped[str | None] = mapped_column(String(80))
    address: Mapped[str | None] = mapped_column(Text)

    # Teklif açılırken öneri olarak kullanılır.
    default_invoice: Mapped[InvoicePreference | None] = mapped_column(String(20))
    default_currency: Mapped[Currency] = mapped_column(String(3), default=Currency.TRY)
    payment_term_days: Mapped[int | None]

    risk_level: Mapped[RiskLevel] = mapped_column(String(10), default=RiskLevel.NORMAL)
    risk_note: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)
    search_text: Mapped[str] = mapped_column(Text, default="", index=True)

    contacts: Mapped[list["CustomerContact"]] = relationship(
        back_populates="customer", order_by="CustomerContact.full_name"
    )


class CustomerContact(TimestampMixin, Base):
    """Müşteri tarafındaki yetkili kişi."""

    __tablename__ = "customer_contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    customer: Mapped[Customer] = relationship(back_populates="contacts")
    full_name: Mapped[str] = mapped_column(String(120))
    title: Mapped[str | None] = mapped_column(String(80))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(254))
    is_primary: Mapped[bool] = mapped_column(default=False)
    is_accounting: Mapped[bool] = mapped_column(default=False)
    is_operation: Mapped[bool] = mapped_column(default=False)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)


class Venue(TimestampMixin, Base):
    """Etkinlik mekânı. Bir müşteriye ait olabilir (ör. otelin kendisi) ya da bağımsızdır."""

    __tablename__ = "venues"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    venue_type: Mapped[VenueType] = mapped_column(String(20))
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"), index=True)
    customer: Mapped[Customer | None] = relationship()
    city: Mapped[str | None] = mapped_column(String(80))
    district: Mapped[str | None] = mapped_column(String(80))
    address: Mapped[str | None] = mapped_column(Text)
    capacity: Mapped[int | None]
    contact_name: Mapped[str | None] = mapped_column(String(120))
    contact_phone: Mapped[str | None] = mapped_column(String(40))
    technical_notes: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)
    search_text: Mapped[str] = mapped_column(Text, default="", index=True)
