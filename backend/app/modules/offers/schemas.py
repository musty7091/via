from datetime import date, datetime, time

from pydantic import BaseModel, Field
from decimal import Decimal
from app.utils.money import Money, OptMoney


class OfferCreate(BaseModel):
    customer_id: int
    venue_id: int | None = None
    package_id: int | None = None
    title: str
    offer_date: date | None = None
    event_date: date | None = None
    valid_until: date | None = None
    invoice_type: str = "without_invoice"
    vat_rate: float = Field(default=0, ge=0)
    currency: str = "TRY"
    advance_payment_amount: Money = Field(default=Decimal("0"), ge=0)
    advance_payment_currency: str = "TRY"
    payment_terms: str | None = None
    customer_visible_notes: str | None = None
    internal_notes: str | None = None


class OfferUpdate(BaseModel):
    customer_id: int | None = None
    title: str | None = None
    status: str | None = None
    venue_id: int | None = None
    package_id: int | None = None
    offer_date: date | None = None
    event_date: date | None = None
    valid_until: date | None = None
    invoice_type: str | None = None
    vat_rate: float | None = Field(default=None, ge=0)
    currency: str | None = None
    advance_payment_amount: OptMoney = Field(default=None, ge=0)
    advance_payment_currency: str | None = None
    payment_terms: str | None = None
    customer_visible_notes: str | None = None
    internal_notes: str | None = None
    agreement_notes: str | None = None


class OfferItemCreate(BaseModel):
    source_type: str = "manual"
    artist_id: int | None = None
    service_item_id: int | None = None
    title: str
    description: str
    program_section: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    quantity: float = Field(default=1, gt=0)
    unit_price: Money = Field(default=Decimal("0"), ge=0)
    currency: str = "TRY"
    internal_unit_cost: Money = Field(default=Decimal("0"), ge=0)
    internal_cost_currency: str = "TRY"
    is_visible_on_offer: bool = True
    sort_order: int = 0


class OfferItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    program_section: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    quantity: float | None = Field(default=None, gt=0)
    unit_price: OptMoney = Field(default=None, ge=0)
    currency: str | None = None
    internal_unit_cost: OptMoney = Field(default=None, ge=0)
    internal_cost_currency: str | None = None
    is_visible_on_offer: bool | None = None
    sort_order: int | None = None


class OfferRead(BaseModel):
    id: int
    event_id: int | None = None
    customer_id: int
    venue_id: int | None = None
    package_id: int | None = None
    offer_no: str | None = None
    title: str
    status: str
    offer_date: date | None = None
    event_date: date | None = None
    valid_until: date | None = None
    invoice_type: str
    vat_rate: float
    amount: Money
    currency: str
    vat_amount: Money
    total_amount: Money
    advance_payment_amount: Money
    advance_payment_currency: str
    payment_terms: str | None = None
    customer_visible_notes: str | None = None
    internal_notes: str | None = None
    agreement_notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class OfferItemRead(BaseModel):
    id: int
    offer_id: int
    source_type: str
    source_package_item_id: int | None = None
    artist_id: int | None = None
    service_item_id: int | None = None
    title: str
    description: str
    program_section: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    quantity: float
    unit_price: Money
    currency: str
    base_amount: Money
    is_visible_on_offer: bool
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class OfferInternalItemRead(OfferItemRead):
    internal_unit_cost: Money
    internal_cost_currency: str
    internal_total_cost: Money
    internal_profit: Money


class OfferSummary(BaseModel):
    currency: str
    visible_amount: Money
    vat_amount: Money
    total_amount: Money


class OfferInternalSummary(BaseModel):
    currency: str
    revenue_amount: Money
    cost_amount: Money
    gross_profit_amount: Money


class OfferDetail(BaseModel):
    offer: OfferRead
    items: list[OfferInternalItemRead]
    visible_summaries: list[OfferSummary]
    internal_summaries: list[OfferInternalSummary]


class OfferPrintLine(BaseModel):
    sort_order: int
    title: str
    description: str
    program_section: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    quantity: float
    unit_price: Money
    currency: str
    line_amount: Money
    show_pricing: bool = True


class OfferPrintView(BaseModel):
    offer_id: int
    offer_no: str | None = None
    title: str
    customer_name: str
    venue_name: str | None = None
    event_date: date | None = None
    valid_until: date | None = None
    invoice_type: str
    vat_rate: float
    customer_visible_notes: str | None = None
    payment_terms: str | None = None
    advance_payment_amount: Money
    advance_payment_currency: str
    lines: list[OfferPrintLine]
    summaries: list[OfferSummary]


class ImportPackageRequest(BaseModel):
    package_id: int
    clear_existing_items: bool = False


class ConvertAgreementRequest(BaseModel):
    agreement_notes: str | None = None