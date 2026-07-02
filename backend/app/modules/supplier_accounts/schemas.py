from datetime import date

from pydantic import BaseModel

from app.utils.money import Money


class SupplierAccountStatementLine(BaseModel):
    line_no: int
    line_date: date

    supplier_kind: str
    supplier_id: int
    supplier_name: str

    event_id: int | None = None
    event_title: str | None = None

    reference_type: str
    reference_id: int

    transaction_type: str
    title: str
    description: str | None = None

    debit_base_amount: Money
    credit_base_amount: Money
    balance_base_amount: Money

    source_amount: Money
    source_currency: str
    exchange_rate: float

    payment_source: str | None = None
    payment_method: str | None = None
    document_no: str | None = None

    status: str
    notes: str | None = None


class SupplierAccountStatementSummary(BaseModel):
    supplier_kind: str
    supplier_id: int
    supplier_name: str

    total_debit_base_amount: Money
    total_credit_base_amount: Money
    balance_base_amount: Money

    open_payable_count: int
    partial_payable_count: int
    paid_payable_count: int

    line_count: int


class SupplierAccountStatementResponse(BaseModel):
    summary: SupplierAccountStatementSummary
    items: list[SupplierAccountStatementLine]

class SupplierAccountBalanceItem(BaseModel):
    supplier_kind: str
    supplier_id: int
    supplier_name: str
    is_active: bool

    total_debit_base_amount: Money
    total_credit_base_amount: Money
    balance_base_amount: Money

    payable_count: int
    payment_count: int
    open_payable_count: int
    partial_payable_count: int
    paid_payable_count: int

    event_count: int
    last_transaction_date: date | None = None


class SupplierAccountBalancesSummary(BaseModel):
    kind: str
    total_supplier_count: int
    total_debit_base_amount: Money
    total_credit_base_amount: Money
    total_balance_base_amount: Money
    positive_balance_supplier_count: int
    zero_balance_supplier_count: int
    negative_balance_supplier_count: int


class SupplierAccountBalancesResponse(BaseModel):
    summary: SupplierAccountBalancesSummary
    items: list[SupplierAccountBalanceItem]
