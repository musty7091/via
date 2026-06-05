from datetime import date, datetime

from pydantic import BaseModel


class FinancialMovementRead(BaseModel):
    id: int
    movement_date: date
    period_month: str | None = None

    source_type: str
    source_id: int | None = None
    movement_group_key: str | None = None

    event_id: int | None = None
    customer_id: int | None = None
    partner_id: int | None = None
    artist_id: int | None = None
    service_item_id: int | None = None
    cash_account_id: int | None = None
    monthly_period_id: int | None = None

    movement_type: str
    account_area: str
    direction: str

    amount: float
    currency: str
    exchange_rate: float
    base_amount: float

    customer_effect: str
    cash_effect: str
    partner_effect: str
    profit_effect: str

    document_no: str | None = None
    title: str
    description: str | None = None
    notes: str | None = None

    status: str
    created_by_user_id: int | None = None
    approved_by_user_id: int | None = None
    approved_at: datetime | None = None

    is_cancelled: bool
    cancellation_reason: str | None = None
    reversed_movement_id: int | None = None

    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class FinancialMovementListResponse(BaseModel):
    total_count: int
    items: list[FinancialMovementRead]


class FinancialMovementSummaryResponse(BaseModel):
    total_count: int
    total_in_base_amount: float
    total_out_base_amount: float
    net_base_amount: float
    company_cash_in_base_amount: float
    company_cash_out_base_amount: float
    partner_cash_in_base_amount: float
    partner_cash_out_base_amount: float
