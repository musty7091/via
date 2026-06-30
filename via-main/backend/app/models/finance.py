from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import TimestampMixin


class FinancialMovement(TimestampMixin, Base):
    """Merkezi finans hareket motoru.

    Para etkisi olusturan her islem bu tabloya izlenebilir bir finans hareketi
    olarak yazilacak. Bu tablo tek basina muhasebe fisi gibi kullanilmaz;
    ilgili tahsilat, gider, devir, ortak veya kapanis kaydinin izini tutar.
    """

    __tablename__ = "financial_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    movement_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    period_month: Mapped[str | None] = mapped_column(String(7), nullable=True, index=True)

    source_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    movement_group_key: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), nullable=True, index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    partner_id: Mapped[int | None] = mapped_column(ForeignKey("partners.id"), nullable=True, index=True)
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"), nullable=True, index=True)
    service_item_id: Mapped[int | None] = mapped_column(ForeignKey("service_items.id"), nullable=True, index=True)
    cash_account_id: Mapped[int | None] = mapped_column(ForeignKey("cash_accounts.id"), nullable=True, index=True)
    monthly_period_id: Mapped[int | None] = mapped_column(ForeignKey("monthly_periods.id"), nullable=True, index=True)

    movement_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    account_area: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    exchange_rate: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=1)
    base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)

    customer_effect: Mapped[str] = mapped_column(String(80), nullable=False, default="none")
    cash_effect: Mapped[str] = mapped_column(String(80), nullable=False, default="none")
    partner_effect: Mapped[str] = mapped_column(String(80), nullable=False, default="none")
    profit_effect: Mapped[str] = mapped_column(String(80), nullable=False, default="none")

    document_no: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(50), nullable=False, default="approved", index=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_cancelled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reversed_movement_id: Mapped[int | None] = mapped_column(ForeignKey("financial_movements.id"), nullable=True, index=True)


class CarryForwardItem(TimestampMixin, Base):
    """Donem kapanisinda sonraki doneme devreden acik kalemler."""

    __tablename__ = "carry_forward_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    carry_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="open", index=True)

    source_period_id: Mapped[int | None] = mapped_column(ForeignKey("monthly_periods.id"), nullable=True, index=True)
    target_period_id: Mapped[int | None] = mapped_column(ForeignKey("monthly_periods.id"), nullable=True, index=True)
    source_period_month: Mapped[str | None] = mapped_column(String(7), nullable=True, index=True)
    target_period_month: Mapped[str | None] = mapped_column(String(7), nullable=True, index=True)

    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), nullable=True, index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    partner_id: Mapped[int | None] = mapped_column(ForeignKey("partners.id"), nullable=True, index=True)
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"), nullable=True, index=True)
    service_item_id: Mapped[int | None] = mapped_column(ForeignKey("service_items.id"), nullable=True, index=True)
    cash_account_id: Mapped[int | None] = mapped_column(ForeignKey("cash_accounts.id"), nullable=True, index=True)

    source_reference_type: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    source_reference_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)

    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    exchange_rate: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=1)
    base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    remaining_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)

    carry_reason: Mapped[str] = mapped_column(Text, nullable=False)
    approval_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    closed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closure_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class EventFinancialClosure(TimestampMixin, Base):
    """Etkinlik bazli finansal kapanis dosyasi.

    Kapanis anindaki tahsilat, gider, borc, ortak ve kar ozetini dondurur.
    """

    __tablename__ = "event_financial_closures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    monthly_period_id: Mapped[int | None] = mapped_column(ForeignKey("monthly_periods.id"), nullable=True, index=True)
    period_month: Mapped[str | None] = mapped_column(String(7), nullable=True, index=True)

    closure_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="open", index=True)

    agreement_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    planned_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    collected_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    remaining_customer_receivable_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    total_event_cost_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_expense_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    remaining_supplier_payable_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    partner_cash_on_hand_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    company_receivable_from_partner_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    company_payable_to_partner_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    operational_profit_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    distributable_profit_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    partner_share_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    is_agreement_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_payment_plan_matched: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_collection_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    are_costs_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    are_expenses_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    are_supplier_debts_closed_or_carried: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    are_partner_cash_items_closed_or_carried: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_profit_calculated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_partner_share_calculated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    prepared_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    prepared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    reopened_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    reopened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reopen_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    closing_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class EventSupplierPayable(TimestampMixin, Base):
    """Etkinlikten dogan sanatci veya hizmet saglayici borcu."""

    __tablename__ = "event_supplier_payables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"), nullable=True, index=True)
    service_item_id: Mapped[int | None] = mapped_column(ForeignKey("service_items.id"), nullable=True, index=True)

    payable_type: Mapped[str] = mapped_column(String(80), nullable=False, default="service", index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    exchange_rate: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=1)
    base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    paid_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    remaining_base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)

    status: Mapped[str] = mapped_column(String(50), nullable=False, default="open", index=True)
    is_carried_forward: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    carry_forward_item_id: Mapped[int | None] = mapped_column(ForeignKey("carry_forward_items.id"), nullable=True, index=True)

    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class EventSupplierPayment(TimestampMixin, Base):
    """Sanatci veya hizmet saglayici borcuna yapilan odeme."""

    __tablename__ = "event_supplier_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    payable_id: Mapped[int] = mapped_column(ForeignKey("event_supplier_payables.id"), nullable=False, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    paid_by_partner_id: Mapped[int | None] = mapped_column(ForeignKey("partners.id"), nullable=True, index=True)
    paid_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    cash_account_id: Mapped[int | None] = mapped_column(ForeignKey("cash_accounts.id"), nullable=True, index=True)

    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="TRY")
    exchange_rate: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=1)
    base_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)

    payment_method: Mapped[str] = mapped_column(String(50), nullable=False, default="cash")
    document_no: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_cancelled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
