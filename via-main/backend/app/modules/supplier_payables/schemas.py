from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator


class SupplierPayableCreate(BaseModel):
    artist_id: int | None = None
    service_item_id: int | None = None
    payable_type: str = Field(default="service", min_length=2, max_length=80)
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    due_date: date | None = None
    amount: float = Field(gt=0)
    currency: str = Field(default="TRY", min_length=2, max_length=10)
    exchange_rate: float = Field(default=1, gt=0)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_supplier_reference(self):
        if self.artist_id is None and self.service_item_id is None:
            raise ValueError("Sanatçı veya hizmet seçimi zorunludur.")

        if self.artist_id is not None and self.service_item_id is not None:
            raise ValueError("Aynı borç kaydında hem sanatçı hem hizmet seçilemez.")

        return self


class SupplierPayableRead(BaseModel):
    id: int
    event_id: int
    artist_id: int | None = None
    service_item_id: int | None = None

    payable_type: str
    title: str
    description: str | None = None
    due_date: date | None = None

    amount: float
    currency: str
    exchange_rate: float
    base_amount: float
    paid_base_amount: float
    remaining_base_amount: float

    status: str
    is_carried_forward: bool
    carry_forward_item_id: int | None = None

    created_by_user_id: int | None = None
    approved_by_user_id: int | None = None
    approved_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class SupplierPaymentCreate(BaseModel):
    paid_by_partner_id: int | None = None
    cash_account_id: int | None = None
    payment_date: date
    amount: float = Field(gt=0)
    currency: str = Field(default="TRY", min_length=2, max_length=10)
    exchange_rate: float = Field(default=1, gt=0)
    payment_method: str = Field(default="cash", min_length=2, max_length=50)
    document_no: str | None = Field(default=None, max_length=100)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_payment_source(self):
        if self.paid_by_partner_id is None and self.cash_account_id is None:
            raise ValueError("Ödeme için ortak veya kasa/banka hesabı seçilmelidir.")

        if self.paid_by_partner_id is not None and self.cash_account_id is not None:
            raise ValueError("Ödeme aynı anda hem ortak hem kasa/banka üzerinden yapılamaz.")

        return self


class SupplierPaymentCancel(BaseModel):
    cancellation_reason: str = Field(min_length=1, max_length=1000)


class SupplierPaymentRead(BaseModel):
    id: int
    payable_id: int
    event_id: int
    paid_by_partner_id: int | None = None
    paid_by_user_id: int | None = None
    cash_account_id: int | None = None

    payment_date: date
    amount: float
    currency: str
    exchange_rate: float
    base_amount: float

    payment_method: str
    document_no: str | None = None
    notes: str | None = None

    is_cancelled: bool
    cancellation_reason: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class SupplierPayablesSummary(BaseModel):
    event_id: int
    total_payable_base_amount: float
    total_paid_base_amount: float
    total_remaining_base_amount: float
    open_payable_count: int
    partial_payable_count: int
    paid_payable_count: int


class EventSupplierPayablesDetail(BaseModel):
    summary: SupplierPayablesSummary
    payables: list[SupplierPayableRead]
    payments: list[SupplierPaymentRead]
