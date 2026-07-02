from datetime import date, datetime

from pydantic import BaseModel, Field

from app.utils.money import Money


class ExpenseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)

    expense_date: date
    amount: Money = Field(gt=0)
    currency: str = Field(default="TRY", max_length=10)
    exchange_rate: float = Field(default=1, gt=0)

    expense_scope: str = Field(default="period", description="period veya season")
    expense_type: str = Field(default="general", max_length=50)

    event_id: int | None = None
    artist_id: int | None = None
    paid_by_partner_id: int | None = None
    paid_by_user_id: int | None = None

    allocation_end_month: str | None = Field(default=None, max_length=7)

    document_no: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)


class ExpenseRead(BaseModel):
    id: int
    expense_type: str

    event_id: int | None = None
    artist_id: int | None = None
    paid_by_partner_id: int | None = None
    paid_by_user_id: int | None = None

    title: str
    description: str | None = None
    expense_date: date

    amount: Money
    currency: str
    exchange_rate: float
    base_amount: Money

    is_allocated: bool
    allocation_start_month: str | None = None
    allocation_end_month: str | None = None

    status: str
    document_no: str | None = None
    is_cancelled: bool
    cancellation_reason: str | None = None

    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class ExpenseAllocationRead(BaseModel):
    id: int
    expense_id: int
    expense_title: str | None = None
    period_month: str
    allocated_base_amount: Money
    notes: str | None = None

    model_config = {
        "from_attributes": True
    }


class ExpenseWithAllocationsRead(BaseModel):
    expense: ExpenseRead
    allocations: list[ExpenseAllocationRead]


class ExpenseCancelRequest(BaseModel):
    cancellation_reason: str = Field(min_length=1, max_length=2000)


class PeriodExpenseSummary(BaseModel):
    period_month: str
    direct_general_expense_base_amount: Money
    allocated_expense_base_amount: Money
    total_period_expense_base_amount: Money
    allocation_count: int
    direct_expense_count: int
