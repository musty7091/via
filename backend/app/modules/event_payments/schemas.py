from datetime import date, datetime

from pydantic import BaseModel, Field


class PaymentPlanCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    due_date: date
    amount: float = Field(gt=0)
    currency: str = Field(default="TRY", min_length=2, max_length=10)
    exchange_rate: float = Field(default=1, gt=0)
    notes: str | None = None


class PaymentPlanUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    due_date: date | None = None
    amount: float | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=2, max_length=10)
    exchange_rate: float | None = Field(default=None, gt=0)
    notes: str | None = None


class PaymentPlanRead(BaseModel):
    id: int
    event_id: int
    title: str
    due_date: date
    amount: float
    currency: str
    exchange_rate: float
    base_amount: float
    paid_base_amount: float
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
    amount: float = Field(gt=0)
    currency: str = Field(default="TRY", min_length=2, max_length=10)
    exchange_rate: float = Field(default=1, gt=0)
    payment_method: str = Field(default="cash", min_length=2, max_length=50)
    document_no: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class CollectionCancel(BaseModel):
    cancellation_reason: str = Field(min_length=1, max_length=1000)


class CollectionRead(BaseModel):
    id: int
    event_id: int
    payment_plan_id: int | None = None
    customer_id: int
    received_by_user_id: int | None = None
    received_by_partner_id: int | None = None
    collection_date: date
    amount: float
    currency: str
    exchange_rate: float
    base_amount: float
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
    event_total_amount: float
    event_currency: str
    event_base_total_amount: float
    planned_base_amount: float
    collected_base_amount: float
    remaining_base_amount: float
    unplanned_base_amount: float


class EventPaymentsDetail(BaseModel):
    summary: EventPaymentSummary
    payment_plans: list[PaymentPlanRead]
    collections: list[CollectionRead]
