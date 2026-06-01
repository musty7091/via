from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import TimestampMixin


class Expense(TimestampMixin, Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    expense_type: Mapped[str] = mapped_column(String(50), nullable=False, default="event")
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), nullable=True, index=True)
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"), nullable=True, index=True)
    paid_by_partner_id: Mapped[int | None] = mapped_column(ForeignKey("partners.id"), nullable=True, index=True)
    paid_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    exchange_rate: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=1)
    base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    is_allocated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allocation_start_month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    allocation_end_month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="approved")
    document_no: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class ExpenseAllocation(TimestampMixin, Base):
    __tablename__ = "expense_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    expense_id: Mapped[int] = mapped_column(ForeignKey("expenses.id"), nullable=False, index=True)
    period_month: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    allocated_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)