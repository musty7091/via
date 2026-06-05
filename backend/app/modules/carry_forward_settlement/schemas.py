from datetime import date, datetime

from pydantic import BaseModel, Field


class CarryForwardSettlementRequest(BaseModel):
    settlement_date: date
    amount: float = Field(gt=0)

    cash_account_id: int | None = None
    payment_method: str = Field(default="cash", max_length=50)
    document_no: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)


class CarryForwardSettlementResponse(BaseModel):
    carry_forward_item_id: int
    carry_type: str
    status: str

    source_period_month: str | None = None
    target_period_month: str | None = None
    event_id: int | None = None
    customer_id: int | None = None
    partner_id: int | None = None
    artist_id: int | None = None
    service_item_id: int | None = None

    settled_base_amount: float
    remaining_base_amount: float

    settlement_date: date
    movement_ids: list[int]
    created_supplier_payment_id: int | None = None

    message: str


class CarryForwardItemDetail(BaseModel):
    id: int
    carry_type: str
    status: str

    source_period_month: str | None = None
    target_period_month: str | None = None
    event_id: int | None = None
    customer_id: int | None = None
    partner_id: int | None = None
    artist_id: int | None = None
    service_item_id: int | None = None

    source_reference_type: str | None = None
    source_reference_id: int | None = None

    amount: float
    currency: str
    exchange_rate: float
    base_amount: float
    remaining_base_amount: float

    carry_reason: str
    approval_note: str | None = None
    closure_note: str | None = None
    notes: str | None = None

    closed_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }
