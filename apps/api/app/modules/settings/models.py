from decimal import Decimal

from sqlalchemy import Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CompanySettings(TimestampMixin, Base):
    """Firma bilgileri ve belge varsayılanları. Tek satırlık tablodur (id=1)."""

    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_name: Mapped[str] = mapped_column(String(160), default="VIA EVENTS")
    legal_name: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(254))
    website: Mapped[str | None] = mapped_column(String(160))
    address: Mapped[str | None] = mapped_column(Text)
    tax_office: Mapped[str | None] = mapped_column(String(80))
    tax_number: Mapped[str | None] = mapped_column(String(40))
    iban: Mapped[str | None] = mapped_column(String(40))

    default_vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("16"))
    offer_validity_days: Mapped[int] = mapped_column(default=15)
    default_payment_terms: Mapped[str | None] = mapped_column(Text)
    offer_footer_note: Mapped[str | None] = mapped_column(Text)
    # Sezonun başladığı ay (1-12); sezon 12 ay sürer. Sezonluk giderler buna göre bölünür.
    season_start_month: Mapped[int] = mapped_column(default=1, server_default="1")
