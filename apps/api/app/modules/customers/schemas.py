from datetime import datetime
from typing import Annotated

from pydantic import EmailStr, Field, field_validator

from app.core.money import Currency
from app.core.schemas import ApiModel, LongText, Name, Phone, ShortText, blank_to_none
from app.modules.customers.models import CustomerType, InvoicePreference, RiskLevel, VenueType

_OPTIONAL_TEXT = (
    "short_name",
    "tax_number",
    "tax_office",
    "phone",
    "email",
    "city",
    "district",
    "address",
    "risk_note",
    "notes",
    "title",
    "contact_name",
    "contact_phone",
    "technical_notes",
)


class _Blankable(ApiModel):
    @field_validator("*", mode="before")
    @classmethod
    def _blank(cls, value: object, info) -> object:  # noqa: ANN001
        return blank_to_none(value) if info.field_name in _OPTIONAL_TEXT else value


# --- Müşteri ---


class CustomerBase(_Blankable):
    customer_type: CustomerType
    name: Name
    short_name: ShortText | None = None
    tax_number: ShortText | None = None
    tax_office: ShortText | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    city: ShortText | None = None
    district: ShortText | None = None
    address: LongText | None = None
    default_invoice: InvoicePreference | None = None
    default_currency: Currency = Currency.TRY
    payment_term_days: Annotated[int, Field(ge=0, le=365)] | None = None
    risk_level: RiskLevel = RiskLevel.NORMAL
    risk_note: LongText | None = None
    notes: LongText | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(_Blankable):
    customer_type: CustomerType | None = None
    name: Name | None = None
    short_name: ShortText | None = None
    tax_number: ShortText | None = None
    tax_office: ShortText | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    city: ShortText | None = None
    district: ShortText | None = None
    address: LongText | None = None
    default_invoice: InvoicePreference | None = None
    default_currency: Currency | None = None
    payment_term_days: Annotated[int, Field(ge=0, le=365)] | None = None
    risk_level: RiskLevel | None = None
    risk_note: LongText | None = None
    notes: LongText | None = None
    is_active: bool | None = None


class CustomerListItem(ApiModel):
    id: int
    customer_type: CustomerType
    name: str
    short_name: str | None
    phone: str | None
    email: str | None
    city: str | None
    risk_level: RiskLevel
    is_active: bool
    primary_contact_name: str | None
    primary_contact_phone: str | None


class ContactRead(ApiModel):
    id: int
    customer_id: int
    full_name: str
    title: str | None
    phone: str | None
    email: str | None
    is_primary: bool
    is_accounting: bool
    is_operation: bool
    notes: str | None
    is_active: bool


class VenueRead(ApiModel):
    id: int
    name: str
    venue_type: VenueType
    customer_id: int | None
    customer_name: str | None
    city: str | None
    district: str | None
    address: str | None
    capacity: int | None
    contact_name: str | None
    contact_phone: str | None
    technical_notes: str | None
    notes: str | None
    is_active: bool


class CustomerRead(CustomerBase):
    id: int
    is_active: bool
    created_at: datetime
    contacts: list[ContactRead]
    venues: list[VenueRead]


# --- Yetkili ---


class ContactCreate(_Blankable):
    full_name: Name
    title: ShortText | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    is_primary: bool = False
    is_accounting: bool = False
    is_operation: bool = False
    notes: LongText | None = None


class ContactUpdate(_Blankable):
    full_name: Name | None = None
    title: ShortText | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    is_primary: bool | None = None
    is_accounting: bool | None = None
    is_operation: bool | None = None
    notes: LongText | None = None
    is_active: bool | None = None


# --- Mekân ---


class VenueCreate(_Blankable):
    name: Name
    venue_type: VenueType
    customer_id: int | None = None
    city: ShortText | None = None
    district: ShortText | None = None
    address: LongText | None = None
    capacity: Annotated[int, Field(gt=0, le=100_000)] | None = None
    contact_name: ShortText | None = None
    contact_phone: Phone | None = None
    technical_notes: LongText | None = None
    notes: LongText | None = None


class VenueUpdate(_Blankable):
    name: Name | None = None
    venue_type: VenueType | None = None
    customer_id: int | None = None
    city: ShortText | None = None
    district: ShortText | None = None
    address: LongText | None = None
    capacity: Annotated[int, Field(gt=0, le=100_000)] | None = None
    contact_name: ShortText | None = None
    contact_phone: Phone | None = None
    technical_notes: LongText | None = None
    notes: LongText | None = None
    is_active: bool | None = None
