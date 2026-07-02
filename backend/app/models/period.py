from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import TimestampMixin


class MonthlyPeriod(TimestampMixin, Base):
    __tablename__ = "monthly_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    period_month: Mapped[str] = mapped_column(String(7), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="open")
    total_revenue_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_event_cost_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_event_expense_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_general_expense_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_allocated_expense_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    net_profit_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    partner_share_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    closed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class MonthlyPartnerSummary(TimestampMixin, Base):
    __tablename__ = "monthly_partner_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    monthly_period_id: Mapped[int] = mapped_column(ForeignKey("monthly_periods.id"), nullable=False, index=True)
    partner_id: Mapped[int] = mapped_column(ForeignKey("partners.id"), nullable=False, index=True)
    profit_share_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    collections_on_partner_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    expenses_paid_by_partner_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    previous_balance_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    net_payable_to_partner_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    net_receivable_from_partner_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
