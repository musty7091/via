from datetime import datetime

from pydantic import BaseModel, Field


class FinancialClosureChecklistItem(BaseModel):
    key: str
    title: str
    is_ok: bool
    blocking: bool
    severity: str
    message: str


class EventFinancialClosureChecklistResponse(BaseModel):
    event_id: int
    event_title: str
    event_status: str
    period_month: str | None = None

    closure_ready: bool
    blocking_issue_count: int
    warning_count: int

    agreement_base_amount: float
    planned_base_amount: float
    period_collected_base_amount: float
    carried_customer_collection_base_amount: float
    collected_base_amount: float
    remaining_customer_receivable_base_amount: float

    total_event_cost_base_amount: float
    total_expense_base_amount: float
    remaining_supplier_payable_base_amount: float

    partner_cash_on_hand_base_amount: float
    company_receivable_from_partner_base_amount: float
    company_payable_to_partner_base_amount: float

    operational_profit_base_amount: float
    distributable_profit_base_amount: float
    partner_share_base_amount: float

    is_agreement_confirmed: bool
    is_payment_plan_matched: bool
    is_collection_completed: bool
    are_costs_completed: bool
    are_expenses_completed: bool
    are_supplier_debts_closed_or_carried: bool
    are_partner_cash_items_closed_or_carried: bool
    is_profit_calculated: bool
    is_partner_share_calculated: bool

    checklist: list[FinancialClosureChecklistItem]


class EventFinancialClosurePrepareRequest(BaseModel):
    closing_note: str | None = Field(default=None, max_length=2000)


class EventFinancialClosureApproveRequest(BaseModel):
    approval_note: str | None = Field(default=None, max_length=2000)


class EventFinancialClosureReopenRequest(BaseModel):
    reopen_reason: str = Field(min_length=1, max_length=2000)


class EventFinancialClosureRead(BaseModel):
    id: int
    event_id: int
    monthly_period_id: int | None = None
    period_month: str | None = None
    closure_version: int
    status: str

    agreement_base_amount: float
    planned_base_amount: float
    collected_base_amount: float
    remaining_customer_receivable_base_amount: float

    total_event_cost_base_amount: float
    total_expense_base_amount: float
    remaining_supplier_payable_base_amount: float

    partner_cash_on_hand_base_amount: float
    company_receivable_from_partner_base_amount: float
    company_payable_to_partner_base_amount: float

    operational_profit_base_amount: float
    distributable_profit_base_amount: float
    partner_share_base_amount: float

    is_agreement_confirmed: bool
    is_payment_plan_matched: bool
    is_collection_completed: bool
    are_costs_completed: bool
    are_expenses_completed: bool
    are_supplier_debts_closed_or_carried: bool
    are_partner_cash_items_closed_or_carried: bool
    is_profit_calculated: bool
    is_partner_share_calculated: bool

    prepared_by_user_id: int | None = None
    prepared_at: datetime | None = None
    approved_by_user_id: int | None = None
    approved_at: datetime | None = None

    reopened_by_user_id: int | None = None
    reopened_at: datetime | None = None
    reopen_reason: str | None = None

    closing_note: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }
