from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import TimestampMixin


class Artist(TimestampMixin, Base):
    __tablename__ = "artists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    artist_type: Mapped[str] = mapped_column(String(50), nullable=False, default="artist")
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    manager_partner_id: Mapped[int | None] = mapped_column(ForeignKey("partners.id"), nullable=True, index=True)
    default_cost_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    default_cost_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    default_sale_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    default_sale_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ArtistRiderTemplateItem(TimestampMixin, Base):
    __tablename__ = "artist_rider_template_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ServiceItem(TimestampMixin, Base):
    __tablename__ = "service_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    service_type: Mapped[str] = mapped_column(String(50), nullable=False, default="service")
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    default_cost_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    default_cost_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    default_sale_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    default_sale_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)