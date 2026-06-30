from datetime import time

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import TimestampMixin


class ServicePackage(TimestampMixin, Base):
    __tablename__ = "service_packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    package_type: Mapped[str] = mapped_column(String(50), nullable=False, default="program")
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    default_sale_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    default_sale_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ServicePackageItem(TimestampMixin, Base):
    __tablename__ = "service_package_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    package_id: Mapped[int] = mapped_column(ForeignKey("service_packages.id"), nullable=False, index=True)

    component_type: Mapped[str] = mapped_column(String(50), nullable=False, default="artist")
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"), nullable=True, index=True)
    service_item_id: Mapped[int | None] = mapped_column(ForeignKey("service_items.id"), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    program_section: Mapped[str | None] = mapped_column(String(100), nullable=True)

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=1)

    unit_cost_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    unit_cost_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    unit_sale_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    unit_sale_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")

    total_cost_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_sale_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    is_optional: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_visible_on_offer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
