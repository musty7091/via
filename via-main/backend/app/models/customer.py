from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import TimestampMixin


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    customer_type: Mapped[str] = mapped_column(String(50), nullable=False, default="company")
    customer_status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    short_name: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    tax_number: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    tax_office: Mapped[str | None] = mapped_column(String(255), nullable=True)

    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)

    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    default_invoice_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    default_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    default_payment_term_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    risk_level: Mapped[str] = mapped_column(String(50), nullable=False, default="normal")
    risk_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)