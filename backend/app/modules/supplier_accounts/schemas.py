from datetime import date

from pydantic import BaseModel


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

    debit_base_amount: float
    credit_base_amount: float
    balance_base_amount: float

    source_amount: float
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

    total_debit_base_amount: float
    total_credit_base_amount: float
    balance_base_amount: float

    open_payable_count: int
    partial_payable_count: int
    paid_payable_count: int

    line_count: int


class SupplierAccountStatementResponse(BaseModel):
    summary: SupplierAccountStatementSummary
    items: list[SupplierAccountStatementLine]
