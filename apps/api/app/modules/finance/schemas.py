from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, field_validator

from app.core.money import Currency
from app.core.schemas import ApiModel, LongText, ShortText, blank_to_none
from app.modules.finance.models import (
    CashAccountType,
    DocStatus,
    ExpenseAllocation,
    ExpenseCategory,
    ExpensePaidBy,
    PartnerTxKind,
    PaymentMethod,
)
from app.modules.offers.schemas import Ref

Rate = Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=6)]
PositiveAmount = Annotated[Decimal, Field(gt=0, max_digits=16, decimal_places=2)]


class _Blankable(ApiModel):
    @field_validator("note", "document_no", "iban", "reason", mode="before", check_fields=False)
    @classmethod
    def _blank(cls, value: object) -> object:
        return blank_to_none(value)


# --- Kasa / banka ---


class CashAccountCreate(_Blankable):
    name: Annotated[str, Field(min_length=2, max_length=120)]
    account_type: CashAccountType
    currency: Currency
    iban: ShortText | None = None


class CashAccountUpdate(_Blankable):
    name: Annotated[str, Field(min_length=2, max_length=120)] | None = None
    iban: ShortText | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class CashAccountRead(ApiModel):
    id: int
    name: str
    account_type: CashAccountType
    currency: Currency
    iban: str | None
    is_active: bool
    balance: Decimal
    balance_base: Decimal


class TransferCreate(_Blankable):
    transfer_date: date
    from_account_id: int
    to_account_id: int
    from_amount: PositiveAmount
    to_amount: PositiveAmount | None = None
    note: LongText | None = None


class Movement(ApiModel):
    """Hesap ekstresi satırı."""

    entry_id: int
    entry_no: str
    entry_date: date
    description: str
    kind: str
    amount: Decimal  # + giriş / − çıkış (orijinal para biriminde)
    currency: Currency
    base: Decimal
    running_amount: Decimal
    event_id: int | None
    is_reversal: bool


# --- Tahsilat ---


class CollectionCreate(_Blankable):
    event_id: int
    collection_date: date
    amount: PositiveAmount
    currency: Currency
    rate: Rate | None = None
    applied_amount: PositiveAmount | None = None
    cash_account_id: int | None = None
    partner_id: int | None = None
    method: PaymentMethod = PaymentMethod.CASH
    document_no: ShortText | None = None
    note: LongText | None = None


class CollectionRead(ApiModel):
    id: int
    collection_no: str
    status: DocStatus
    event: Ref
    customer: Ref
    collection_date: date
    amount: Decimal
    currency: Currency
    rate: Decimal
    applied_amount: Decimal
    event_currency: Currency
    destination: str  # "Merkez Kasa" veya "Alper (ortak üzerinde)"
    cash_account_id: int | None
    partner_id: int | None
    method: PaymentMethod
    document_no: str | None
    note: str | None
    cancel_reason: str | None
    created_at: datetime


class CancelRequest(_Blankable):
    reason: Annotated[str, Field(min_length=3, max_length=1000)]


# --- Borç / ödeme ---


class PayableCreate(_Blankable):
    event_id: int
    title: Annotated[str, Field(min_length=2, max_length=200)]
    amount: PositiveAmount
    currency: Currency
    rate: Rate | None = None
    artist_id: int | None = None
    supplier_id: int | None = None
    due_date: date | None = None
    note: LongText | None = None


class PayableUpdate(_Blankable):
    title: Annotated[str, Field(min_length=2, max_length=200)] | None = None
    amount: PositiveAmount | None = None
    rate: Rate | None = None
    artist_id: int | None = None
    supplier_id: int | None = None
    due_date: date | None = None
    note: LongText | None = None


class PaymentCreate(_Blankable):
    payment_date: date
    amount: PositiveAmount
    currency: Currency
    rate: Rate | None = None
    applied_amount: PositiveAmount | None = None
    cash_account_id: int | None = None
    partner_id: int | None = None
    method: PaymentMethod = PaymentMethod.BANK_TRANSFER
    document_no: ShortText | None = None
    note: LongText | None = None


class PaymentRead(ApiModel):
    id: int
    payment_no: str
    status: DocStatus
    payable_id: int
    payment_date: date
    amount: Decimal
    currency: Currency
    rate: Decimal
    applied_amount: Decimal
    source: str
    method: PaymentMethod
    document_no: str | None
    note: str | None
    cancel_reason: str | None


PayableState = Literal["open", "partial", "paid", "cancelled"]


class PayableRead(ApiModel):
    id: int
    status: DocStatus
    state: PayableState
    event: Ref | None
    payee: Ref | None
    payee_type: Literal["artist", "supplier"] | None
    title: str
    amount: Decimal
    currency: Currency
    rate: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    remaining_base: Decimal
    due_date: date | None
    is_overdue: bool
    from_expense: bool
    note: str | None
    payments: list[PaymentRead]


# --- Gider ---


class ExpenseCreate(_Blankable):
    expense_date: date
    category: ExpenseCategory
    title: Annotated[str, Field(min_length=2, max_length=200)]
    amount: PositiveAmount
    currency: Currency
    rate: Rate | None = None
    event_id: int | None = None
    # Genel gider: bu aya mı, sezonun tamamına mı, bu aydan sezon sonuna mı ait?
    allocation: ExpenseAllocation = ExpenseAllocation.MONTH
    # Eski kullanım: gider ayından bu aya (YYYY-AA) kadar böl.
    spread_until: Annotated[str, Field(pattern=r"^\d{4}-\d{2}$")] | None = None
    paid_by: ExpensePaidBy
    cash_account_id: int | None = None
    partner_id: int | None = None
    supplier_id: int | None = None
    document_no: ShortText | None = None
    note: LongText | None = None


class ExpenseRead(ApiModel):
    id: int
    expense_no: str
    status: DocStatus
    expense_date: date
    category: ExpenseCategory
    title: str
    event: Ref | None
    amount: Decimal
    currency: Currency
    base_amount: Decimal
    paid_by: ExpensePaidBy
    allocation: ExpenseAllocation
    spread_from: str | None
    spread_until: str | None
    paid_from: str
    payable_id: int | None
    document_no: str | None
    note: str | None
    cancel_reason: str | None


# --- Ortaklar ---


class PartnerTxCreate(_Blankable):
    kind: PartnerTxKind
    partner_id: int
    tx_date: date
    amount: PositiveAmount
    currency: Currency
    cash_account_id: int | None = None
    note: LongText | None = None


class PartnerTxRead(ApiModel):
    id: int
    status: DocStatus
    kind: PartnerTxKind
    partner: Ref
    tx_date: date
    amount: Decimal
    currency: Currency
    cash_account: Ref | None
    note: str | None
    cancel_reason: str | None


class CurrencyAmount(ApiModel):
    currency: Currency
    amount: Decimal


class PartnerBalance(ApiModel):
    partner: Ref
    held: list[CurrencyAmount]  # ortak üzerindeki şirket parası
    owed: list[CurrencyAmount]  # şirketin ortağa borcu
    held_base: Decimal
    owed_base: Decimal
    net_base: Decimal  # + ortak şirkete borçlu, − şirket ortağa borçlu


class StatementLine(ApiModel):
    entry_id: int
    entry_no: str
    entry_date: date
    description: str
    account: str
    debit: Decimal
    credit: Decimal
    amount: Decimal
    currency: Currency
    running_base: Decimal
    event_id: int | None
    is_reversal: bool


# --- Ödeme planı ---


class PaymentPlanCreate(ApiModel):
    title: Annotated[str, Field(min_length=2, max_length=120)]
    due_date: date
    amount: PositiveAmount


class PaymentPlanUpdate(ApiModel):
    title: Annotated[str, Field(min_length=2, max_length=120)] | None = None
    due_date: date | None = None
    amount: PositiveAmount | None = None


class PaymentPlanRead(ApiModel):
    id: int
    title: str
    due_date: date
    amount: Decimal
    covered_amount: Decimal
    state: Literal["paid", "partial", "open", "overdue"]


# --- Özetler ---


class EventFinance(ApiModel):
    event_id: int
    currency: Currency
    exchange_rate: Decimal
    total_amount: Decimal
    collected_amount: Decimal
    written_off_amount: Decimal
    remaining_amount: Decimal
    receivable_base: Decimal
    plan_total: Decimal
    plan_difference: Decimal
    plans: list[PaymentPlanRead]
    collections: list[CollectionRead]
    payables: list[PayableRead]
    expenses: list[ExpenseRead]
    # TL karşılıkları (defterden)
    revenue_base: Decimal
    cost_base: Decimal
    expense_base: Decimal
    fx_base: Decimal
    profit_base: Decimal
    payables_remaining_base: Decimal
    # İptal edilen etkinlikte şirkette kalan / müşteriye iade edilen (etkinlik dövizinde)
    cancel_kept_amount: Decimal = Decimal("0")
    cancel_refunded_amount: Decimal = Decimal("0")


class OverviewTotals(ApiModel):
    cash_base: Decimal
    receivables_base: Decimal
    payables_base: Decimal
    partner_held_base: Decimal
    owed_to_partners_base: Decimal
    vat_payable_base: Decimal
    overdue_plans: int
    overdue_payables: int


class FinanceOverview(ApiModel):
    totals: OverviewTotals
    cash_accounts: list[CashAccountRead]
    partners: list[PartnerBalance]
    open_receivables: list[dict]
