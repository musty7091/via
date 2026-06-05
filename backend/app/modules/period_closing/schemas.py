from datetime import datetime
from pydantic import BaseModel, Field


class PeriodClosingPreviewItem(BaseModel):
    carry_type: str
    event_id: int | None = None
    event_title: str | None = None
    customer_id: int | None = None
    partner_id: int | None = None
    artist_id: int | None = None
    service_item_id: int | None = None
    source_reference_type: str | None = None
    source_reference_id: int | None = None
    amount: float
    currency: str = "TRY"
    exchange_rate: float = 1
    base_amount: float
    remaining_base_amount: float
    carry_reason: str


class PeriodClosingPreviewSummary(BaseModel):
    period_month: str
    target_period_month: str
    source_period_status: str | None = None
    source_period_is_locked: bool = False

    event_count: int
    open_event_count: int

    total_revenue_base_amount: float
    total_event_cost_base_amount: float
    total_event_expense_base_amount: float
    net_profit_base_amount: float

    customer_receivable_base_amount: float
    supplier_payable_base_amount: float
    partner_cash_on_hand_base_amount: float
    company_payable_to_partner_base_amount: float

    carry_forward_count: int
    blocking_issue_count: int
    warning_count: int

    can_close_period: bool


class PeriodClosingIssue(BaseModel):
    key: str
    severity: str
    blocking: bool
    message: str


class PeriodClosingPreviewResponse(BaseModel):
    summary: PeriodClosingPreviewSummary
    issues: list[PeriodClosingIssue]
    carry_forward_items: list[PeriodClosingPreviewItem]


class PeriodCloseRequest(BaseModel):
    closing_note: str | None = Field(default=None, max_length=2000)


class PeriodCloseResponse(BaseModel):
    period_month: str
    target_period_month: str
    monthly_period_id: int
    target_monthly_period_id: int | None = None
    status: str
    is_locked: bool
    closed_at: datetime | None = None

    created_carry_forward_count: int
    event_count: int
    open_event_count: int

    total_revenue_base_amount: float
    total_event_cost_base_amount: float
    total_event_expense_base_amount: float
    net_profit_base_amount: float

    message: str


class CarryForwardItemRead(BaseModel):
    id: int
    carry_type: str
    status: str

    source_period_id: int | None = None
    target_period_id: int | None = None
    source_period_month: str | None = None
    target_period_month: str | None = None

    event_id: int | None = None
    customer_id: int | None = None
    partner_id: int | None = None
    artist_id: int | None = None
    service_item_id: int | None = None
    cash_account_id: int | None = None

    source_reference_type: str | None = None
    source_reference_id: int | None = None

    amount: float
    currency: str
    exchange_rate: float
    base_amount: float
    remaining_base_amount: float

    carry_reason: str
    approval_note: str | None = None
    notes: str | None = None

    model_config = {
        "from_attributes": True
    }
