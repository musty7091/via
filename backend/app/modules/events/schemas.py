from datetime import date, datetime

from pydantic import BaseModel

from app.utils.money import Money


class EventStatusUpdate(BaseModel):
    status: str


class EventRead(BaseModel):
    id: int
    event_code: str | None = None
    title: str
    customer_id: int
    venue_id: int | None = None
    responsible_partner_id: int | None = None
    operation_user_id: int | None = None
    event_date: date
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    status: str
    invoice_type: str
    vat_rate: float
    agreement_amount: Money
    agreement_currency: str
    vat_amount: Money
    total_customer_amount: Money
    notes: str | None = None
    is_period_closed: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class EventItemRead(BaseModel):
    id: int
    event_id: int
    item_type: str
    artist_id: int | None = None
    service_item_id: int | None = None
    description: str | None = None
    sale_amount: Money
    sale_currency: str
    cost_amount: Money
    cost_currency: str
    exchange_rate: float
    base_sale_amount: Money
    base_cost_amount: Money
    sort_order: int
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class EventDetail(BaseModel):
    event: EventRead
    items: list[EventItemRead]
