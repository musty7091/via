from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator

from app.core.money import Currency
from app.core.schemas import Amount, ApiModel, LongText, Quantity, blank_to_none
from app.modules.catalog.models import ProgramSection
from app.modules.customers.models import InvoicePreference
from app.modules.offers.models import LineType, OfferStatus

Title = Annotated[str, Field(min_length=2, max_length=200)]
Rate = Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=6)]
VatRate = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]
GuestCount = Annotated[int, Field(gt=0, le=100_000)]

_TEXT = {"payment_terms", "customer_notes", "internal_notes", "description", "note"}


class _Blankable(ApiModel):
    @field_validator("*", mode="before")
    @classmethod
    def _blank(cls, value: object, info) -> object:  # noqa: ANN001
        return blank_to_none(value) if info.field_name in _TEXT else value


def _check_times(start: time | None, end: time | None) -> None:
    if (start is None) != (end is None):
        raise ValueError("Başlangıç ve bitiş saati birlikte girilmelidir.")


# --- Teklif ---


class OfferCreate(_Blankable):
    customer_id: int
    contact_id: int | None = None
    venue_id: int | None = None
    # Verilmezse giriş yapan kullanıcının bağlı olduğu ortak kullanılır.
    partner_id: int | None = None
    title: Title
    event_date: date | None = None
    event_start: time | None = None
    event_end: time | None = None
    guest_count: GuestCount | None = None
    valid_until: date | None = None
    # Verilmezse müşterinin varsayılanları ve firma ayarları kullanılır.
    invoice_type: InvoicePreference | None = None
    vat_rate: VatRate | None = None
    currency: Currency | None = None
    exchange_rate: Rate | None = None
    discount_amount: Amount = Decimal("0")
    advance_amount: Amount = Decimal("0")
    payment_terms: LongText | None = None
    customer_notes: LongText | None = None
    internal_notes: LongText | None = None
    package_id: int | None = None

    @model_validator(mode="after")
    def _times(self) -> "OfferCreate":
        _check_times(self.event_start, self.event_end)
        return self


class OfferUpdate(_Blankable):
    customer_id: int | None = None
    contact_id: int | None = None
    venue_id: int | None = None
    partner_id: int | None = None
    title: Title | None = None
    event_date: date | None = None
    event_start: time | None = None
    event_end: time | None = None
    guest_count: GuestCount | None = None
    valid_until: date | None = None
    invoice_type: InvoicePreference | None = None
    vat_rate: VatRate | None = None
    currency: Currency | None = None
    exchange_rate: Rate | None = None
    discount_amount: Amount | None = None
    advance_amount: Amount | None = None
    payment_terms: LongText | None = None
    customer_notes: LongText | None = None
    internal_notes: LongText | None = None


class OfferAction(_Blankable):
    action: Literal["send", "accept", "reject", "cancel", "reopen"]
    note: LongText | None = None


class OfferConvert(_Blankable):
    note: LongText | None = None


# --- Satırlar ---


class OfferLineCreate(_Blankable):
    line_type: Literal[LineType.ARTIST, LineType.SERVICE, LineType.CUSTOM]
    artist_id: int | None = None
    service_id: int | None = None
    title: Annotated[str, Field(max_length=200)] | None = None
    description: LongText | None = None
    program_section: ProgramSection | None = None
    start_time: time | None = None
    end_time: time | None = None
    quantity: Quantity = Decimal("1")
    unit_price: Amount | None = None
    unit_cost: Amount | None = None
    cost_currency: Currency | None = None
    cost_rate: Rate | None = None
    is_visible: bool = True

    @model_validator(mode="after")
    def _check(self) -> "OfferLineCreate":
        if self.line_type == LineType.ARTIST and (self.artist_id is None or self.service_id):
            raise ValueError("Sanatçı satırı için sadece sanatçı seçilmelidir.")
        if self.line_type == LineType.SERVICE and (self.service_id is None or self.artist_id):
            raise ValueError("Hizmet satırı için sadece hizmet seçilmelidir.")
        if self.line_type == LineType.CUSTOM and (
            self.artist_id or self.service_id or not (self.title and self.title.strip())
        ):
            raise ValueError("Serbest satır için başlık zorunludur.")
        _check_times(self.start_time, self.end_time)
        return self


class OfferLineUpdate(_Blankable):
    title: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    description: LongText | None = None
    program_section: ProgramSection | None = None
    start_time: time | None = None
    end_time: time | None = None
    quantity: Quantity | None = None
    unit_price: Amount | None = None
    unit_cost: Amount | None = None
    cost_currency: Currency | None = None
    cost_rate: Rate | None = None
    is_visible: bool | None = None
    sort_order: int | None = None


class PackageImport(ApiModel):
    package_id: int
    # Paket para birimi teklifle farklıysa fiyat elle verilmelidir.
    price: Amount | None = None


# --- Okuma ---


class Ref(ApiModel):
    id: int
    name: str


class OfferLineRead(ApiModel):
    id: int
    line_type: LineType
    parent_id: int | None
    package_id: int | None
    artist_id: int | None
    service_id: int | None
    title: str
    description: str | None
    program_section: ProgramSection | None
    start_time: time | None
    end_time: time | None
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal
    is_visible: bool
    sort_order: int
    # Maliyet yetkisi yoksa None
    unit_cost: Decimal | None
    cost_currency: Currency | None
    cost_rate: Decimal | None
    cost_total_base: Decimal | None


class Profitability(ApiModel):
    """İç kârlılık tahmini, TL cinsinden (teklif ve maliyet kurlarıyla)."""

    revenue_base: Decimal
    cost_base: Decimal
    profit_base: Decimal
    margin_percent: Decimal | None
    warnings: list[str]


class OfferListItem(ApiModel):
    id: int
    offer_no: str
    status: OfferStatus
    is_expired: bool
    title: str
    customer: Ref
    partner: Ref
    event_date: date | None
    offer_date: date
    valid_until: date
    currency: Currency
    total_amount: Decimal
    event_id: int | None


class OfferDetail(ApiModel):
    id: int
    offer_no: str
    status: OfferStatus
    is_expired: bool
    customer: Ref
    customer_risk_level: str
    contact: Ref | None
    venue: Ref | None
    partner: Ref
    title: str
    event_date: date | None
    event_start: time | None
    event_end: time | None
    guest_count: int | None
    offer_date: date
    valid_until: date
    invoice_type: InvoicePreference
    vat_rate: Decimal
    currency: Currency
    exchange_rate: Decimal
    subtotal: Decimal
    discount_amount: Decimal
    net_amount: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    advance_amount: Decimal
    remaining_amount: Decimal
    base_total_amount: Decimal
    payment_terms: str | None
    customer_notes: str | None
    internal_notes: str | None
    status_note: str | None
    sent_at: datetime | None
    decided_at: datetime | None
    created_at: datetime
    created_by_name: str | None
    event_id: int | None
    lines: list[OfferLineRead]
    profitability: Profitability | None
    allowed_actions: list[str]


# --- Yazdırma (müşteri çıktısı; maliyet içermez) ---


class PrintLine(ApiModel):
    title: str
    description: str | None
    start_time: time | None
    end_time: time | None
    quantity: Decimal
    unit_price: Decimal | None  # paket içeriğinde None ("Dahil")
    line_total: Decimal | None
    components: list["PrintLine"] = []


class CompanyInfo(ApiModel):
    company_name: str
    legal_name: str | None
    phone: str | None
    email: str | None
    website: str | None
    address: str | None
    tax_office: str | None
    tax_number: str | None
    iban: str | None
    offer_footer_note: str | None


class OfferPrint(ApiModel):
    company: CompanyInfo
    offer_no: str
    offer_date: date
    valid_until: date
    title: str
    customer_name: str
    customer_address: str | None
    customer_tax: str | None
    contact_name: str | None
    contact_phone: str | None
    venue_name: str | None
    event_date: date | None
    event_start: time | None
    event_end: time | None
    guest_count: int | None
    invoice_type: InvoicePreference
    vat_rate: Decimal
    currency: Currency
    lines: list[PrintLine]
    subtotal: Decimal
    discount_amount: Decimal
    net_amount: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    advance_amount: Decimal
    remaining_amount: Decimal
    payment_terms: str | None
    customer_notes: str | None
