from datetime import date, datetime

from pydantic import BaseModel, Field

from app.utils.money import Money, OptMoney


class CustomerLedgerMovementCreate(BaseModel):
    movement_date: date
    movement_type: str = "manual_adjustment"
    direction: str
    title: str
    description: str | None = None
    detail_note: str | None = None
    amount: Money = Field(gt=0)
    currency: str = "TRY"
    exchange_rate: float = Field(default=1, gt=0)
    base_amount: OptMoney = None
    payment_method: str | None = None
    collected_by_partner_id: int | None = None
    document_no: str | None = None
    reference_type: str | None = None
    reference_id: int | None = None
    notes: str | None = None


class CustomerLedgerMovementRead(BaseModel):
    id: int
    customer_id: int
    event_id: int | None = None
    event_title: str | None = None
    collection_id: int | None = None
    payment_plan_id: int | None = None
    movement_date: date
    movement_type: str
    direction: str
    title: str
    description: str | None = None
    detail_note: str | None = None
    amount: Money
    currency: str
    exchange_rate: float
    base_amount: Money
    debit_base_amount: Money
    credit_base_amount: Money
    running_balance_base_amount: Money
    payment_method: str | None = None
    collected_by_partner_id: int | None = None
    collected_by_partner_name: str | None = None
    created_by_user_id: int | None = None
    document_no: str | None = None
    reference_type: str | None = None
    reference_id: int | None = None
    is_cancelled: bool
    cancellation_reason: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class CustomerLedgerSummary(BaseModel):
    customer_id: int
    total_debit_base_amount: Money
    total_credit_base_amount: Money
    balance_base_amount: Money
    movement_count: int
    last_movement_date: date | None = None
