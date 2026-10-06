from datetime import time
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import ForeignKey, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.money import Currency
from app.db.base import Base, TimestampMixin
from app.modules.partners.models import Partner


class ArtistType(StrEnum):
    SOLO = "solo"
    BAND = "band"
    DJ = "dj"
    DANCER = "dancer"
    DANCE_GROUP = "dance_group"
    PRESENTER = "presenter"
    OTHER = "other"


class ServiceType(StrEnum):
    SOUND = "sound"
    LIGHT = "light"
    STAGE = "stage"
    SCREEN = "screen"
    PHOTO_VIDEO = "photo_video"
    DECORATION = "decoration"
    CATERING = "catering"
    TRANSPORT = "transport"
    STAFF = "staff"
    OTHER = "other"


class ServiceUnit(StrEnum):
    PIECE = "piece"
    DAY = "day"
    HOUR = "hour"
    PERSON = "person"
    SET = "set"


class RiderCategory(StrEnum):
    TECHNICAL = "technical"
    BACKSTAGE = "backstage"
    HOSPITALITY = "hospitality"
    TRANSPORT = "transport"
    OTHER = "other"


class PackageType(StrEnum):
    PROGRAM = "program"
    TECHNICAL = "technical"
    COMBO = "combo"


class ComponentType(StrEnum):
    ARTIST = "artist"
    SERVICE = "service"
    CUSTOM = "custom"


class ProgramSection(StrEnum):
    OPENING = "opening"
    WARMUP = "warmup"
    MAIN = "main"
    SUPPORT = "support"
    CLOSING = "closing"
    TECHNICAL = "technical"
    OTHER = "other"


class Supplier(TimestampMixin, Base):
    """Hizmet sağlayan firma/kişi (ses sistemi, LED ekran, ulaşım...). Ödeme yapılacak taraf."""

    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    contact_name: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(254))
    tax_number: Mapped[str | None] = mapped_column(String(40))
    iban: Mapped[str | None] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)
    search_text: Mapped[str] = mapped_column(Text, default="", index=True)


class Artist(TimestampMixin, Base):
    """Sanatçı, grup, DJ veya dansçı. Kendisi doğrudan ödeme yapılan taraftır."""

    __tablename__ = "artists"

    id: Mapped[int] = mapped_column(primary_key=True)
    artist_type: Mapped[ArtistType] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(160))
    # Sanatçının menajerliğini yapan ortak (işi kim getirdi takibi için)
    manager_partner_id: Mapped[int | None] = mapped_column(ForeignKey("partners.id"))
    manager_partner: Mapped[Partner | None] = relationship()
    contact_name: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(254))
    iban: Mapped[str | None] = mapped_column(String(40))

    default_cost: Mapped[Decimal | None]
    cost_currency: Mapped[Currency] = mapped_column(String(3), default=Currency.TRY)
    default_price: Mapped[Decimal | None]
    price_currency: Mapped[Currency] = mapped_column(String(3), default=Currency.TRY)

    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)
    search_text: Mapped[str] = mapped_column(Text, default="", index=True)

    rider_items: Mapped[list["ArtistRiderItem"]] = relationship(
        back_populates="artist",
        order_by=lambda: (ArtistRiderItem.sort_order, ArtistRiderItem.id),
    )


class ArtistRiderItem(TimestampMixin, Base):
    """Sanatçının rider/kulis şartı (şablon). Etkinlikte kontrol listesine kopyalanır."""

    __tablename__ = "artist_rider_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"), index=True)
    artist: Mapped[Artist] = relationship(back_populates="rider_items")
    category: Mapped[RiderCategory] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    is_required: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(default=True)


class ServiceItem(TimestampMixin, Base):
    """Teknik/operasyon hizmeti (ses, ışık, sahne, LED...)."""

    __tablename__ = "service_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    service_type: Mapped[ServiceType] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(160))
    unit: Mapped[ServiceUnit] = mapped_column(String(10), default=ServiceUnit.PIECE)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"))
    supplier: Mapped[Supplier | None] = relationship()

    default_cost: Mapped[Decimal | None]
    cost_currency: Mapped[Currency] = mapped_column(String(3), default=Currency.TRY)
    default_price: Mapped[Decimal | None]
    price_currency: Mapped[Currency] = mapped_column(String(3), default=Currency.TRY)

    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)
    search_text: Mapped[str] = mapped_column(Text, default="", index=True)


class Package(TimestampMixin, Base):
    """Program/kombo paket. Müşteriye TEK fiyatla satılır; içerik kalemleri fiyatlanmaz
    (OFFER_PACKAGE_PRICING_RULE). Kalem maliyetleri sadece iç kârlılık içindir."""

    __tablename__ = "packages"

    id: Mapped[int] = mapped_column(primary_key=True)
    package_type: Mapped[PackageType] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)  # müşteriye görünür
    internal_notes: Mapped[str | None] = mapped_column(Text)
    price: Mapped[Decimal]
    currency: Mapped[Currency] = mapped_column(String(3), default=Currency.TRY)
    is_active: Mapped[bool] = mapped_column(default=True)
    search_text: Mapped[str] = mapped_column(Text, default="", index=True)

    items: Mapped[list["PackageItem"]] = relationship(
        back_populates="package",
        order_by=lambda: (PackageItem.sort_order, PackageItem.id),
        cascade="all, delete-orphan",
    )


class PackageItem(TimestampMixin, Base):
    __tablename__ = "package_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    package_id: Mapped[int] = mapped_column(ForeignKey("packages.id"), index=True)
    package: Mapped[Package] = relationship(back_populates="items")
    component_type: Mapped[ComponentType] = mapped_column(String(10))
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"))
    artist: Mapped[Artist | None] = relationship()
    service_id: Mapped[int | None] = mapped_column(ForeignKey("service_items.id"))
    service: Mapped[ServiceItem | None] = relationship()
    title: Mapped[str] = mapped_column(String(160))
    program_section: Mapped[ProgramSection] = mapped_column(String(20))
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("1"))
    unit_cost: Mapped[Decimal]
    cost_currency: Mapped[Currency] = mapped_column(String(3), default=Currency.TRY)
    is_visible_on_offer: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)
    notes: Mapped[str | None] = mapped_column(Text)
