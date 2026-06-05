from datetime import date

from pydantic import BaseModel


class PartnerAccountStatementLine(BaseModel):
    line_no: int
    line_date: date

    partner_id: int
    partner_name: str

    event_id: int | None = None
    event_title: str | None = None

    source_type: str
    source_id: int | None = None
    movement_type: str
    account_area: str
    partner_effect: str

    title: str
    description: str | None = None

    company_receivable_debit_base_amount: float
    company_receivable_credit_base_amount: float
    company_payable_debit_base_amount: float
    company_payable_credit_base_amount: float

    net_balance_base_amount: float
    balance_direction: str

    source_amount: float
    source_currency: str
    exchange_rate: float

    document_no: str | None = None
    status: str
    notes: str | None = None


class PartnerAccountStatementSummary(BaseModel):
    partner_id: int
    partner_name: str

    total_company_receivable_debit_base_amount: float
    total_company_receivable_credit_base_amount: float
    company_receivable_balance_base_amount: float

    total_company_payable_credit_base_amount: float
    total_company_payable_debit_base_amount: float
    company_payable_balance_base_amount: float

    net_balance_base_amount: float
    balance_direction: str

    line_count: int


class PartnerAccountStatementResponse(BaseModel):
    summary: PartnerAccountStatementSummary
    items: list[PartnerAccountStatementLine]


class PartnerAccountBalanceItem(BaseModel):
    partner_id: int
    partner_name: str
    is_active: bool

    company_receivable_balance_base_amount: float
    company_payable_balance_base_amount: float
    net_balance_base_amount: float
    balance_direction: str

    movement_count: int
    event_count: int
    last_transaction_date: date | None = None


class PartnerAccountBalancesSummary(BaseModel):
    total_partner_count: int

    total_company_receivable_balance_base_amount: float
    total_company_payable_balance_base_amount: float
    total_net_balance_base_amount: float

    partner_owes_company_count: int
    company_owes_partner_count: int
    balanced_partner_count: int


class PartnerAccountBalancesResponse(BaseModel):
    summary: PartnerAccountBalancesSummary
    items: list[PartnerAccountBalanceItem]
