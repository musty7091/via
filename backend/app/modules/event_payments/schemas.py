from datetime import date, datetime

from pydantic import BaseModel, Field
from app.utils.money import Money, OptMoney


class PaymentPlanCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    due_date: date
    amount: Money = Field(gt=0)
    currency: str = Field(default="TRY", min_length=2, max_length=10)
    exchange_rate: float = Field(default=1, gt=0)
    notes: str | None = None


class PaymentPlanUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    due_date: date | None = None
    amount: OptMoney = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=2, max_length=10)
    exchange_rate: float | None = Field(default=None, gt=0)
    notes: str | None = None


class PaymentPlanRead(BaseModel):
    id: int
    event_id: int
    title: str
    due_date: date
    amount: Money
    currency: str
    exchange_rate: float
    base_amount: Money
    paid_base_amount: Money
    status: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class CollectionCreate(BaseModel):
    payment_plan_id: int | None = None
    received_by_partner_id: int | None = None
    collection_date: date
    amount: Money = Field(gt=0)
    currency: str = Field(default="TRY", min_length=2, max_length=10)
    exchange_rate: float = Field(default=1, gt=0)
    payment_method: str = Field(default="cash", min_length=2, max_length=50)
    document_no: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class CollectionCancel(BaseModel):
    cancellation_reason: str = Field(min_length=1, max_length=1000)


class CashTransferCreate(BaseModel):
    to_cash_account_id: int
    transfer_date: date
    transfer_method: str = Field(default="cash", min_length=2, max_length=50)
    document_no: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class CashTransferRead(BaseModel):
    id: int
    collection_id: int | None = None
    from_partner_id: int | None = None
    from_user_id: int | None = None
    to_cash_account_id: int
    approved_by_user_id: int | None = None
    transfer_date: date
    amount: Money
    currency: str
    exchange_rate: float
    base_amount: Money
    transfer_method: str
    document_no: str | None = None
    status: str
    print_count: int
    notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class CollectionRead(BaseModel):
    id: int
    event_id: int
    payment_plan_id: int | None = None
    customer_id: int
    received_by_user_id: int | None = None
    received_by_partner_id: int | None = None
    collection_date: date
    amount: Money
    currency: str
    exchange_rate: float
    base_amount: Money
    payment_method: str
    current_location: str
    is_transferred_to_company: bool
    transferred_at: datetime | None = None
    document_no: str | None = None
    notes: str | None = None
    is_cancelled: bool
    cancellation_reason: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class EventPaymentSummary(BaseModel):
    event_id: int
    event_total_amount: Money
    event_currency: str
    event_base_total_amount: Money
    planned_base_amount: Money
    collected_base_amount: Money
    remaining_base_amount: Money
    unplanned_base_amount: Money


class EventPaymentsDetail(BaseModel):
    summary: EventPaymentSummary
    payment_plans: list[PaymentPlanRead]
    collections: list[CollectionRead]
    cash_transfers: list[CashTransferRead]
