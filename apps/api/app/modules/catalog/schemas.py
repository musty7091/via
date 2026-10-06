from datetime import time
from decimal import Decimal

from pydantic import EmailStr, field_validator, model_validator

from app.core.money import Currency
from app.core.schemas import (
    Amount,
    ApiModel,
    LongText,
    MoneyValue,
    Name,
    Phone,
    Quantity,
    ShortText,
    blank_to_none,
)
from app.modules.catalog.models import (
    ArtistType,
    ComponentType,
    PackageType,
    ProgramSection,
    RiderCategory,
    ServiceType,
    ServiceUnit,
)

_OPTIONAL_TEXT = {
    "contact_name",
    "phone",
    "email",
    "tax_number",
    "iban",
    "notes",
    "description",
    "internal_notes",
    "title",
}


class _Blankable(ApiModel):
    @field_validator("*", mode="before")
    @classmethod
    def _blank(cls, value: object, info) -> object:  # noqa: ANN001
        return blank_to_none(value) if info.field_name in _OPTIONAL_TEXT else value


def _normalize_iban(value: str | None) -> str | None:
    return value.replace(" ", "").upper() if value else value


# --- Tedarikçi ---


class SupplierCreate(_Blankable):
    name: Name
    contact_name: ShortText | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    tax_number: ShortText | None = None
    iban: ShortText | None = None
    notes: LongText | None = None

    _iban = field_validator("iban")(_normalize_iban)


class SupplierUpdate(_Blankable):
    name: Name | None = None
    contact_name: ShortText | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    tax_number: ShortText | None = None
    iban: ShortText | None = None
    notes: LongText | None = None
    is_active: bool | None = None

    _iban = field_validator("iban")(_normalize_iban)


class SupplierRead(ApiModel):
    id: int
    name: str
    contact_name: str | None
    phone: str | None
    email: str | None
    tax_number: str | None
    iban: str | None
    notes: str | None
    is_active: bool


# --- Sanatçı ---


class ArtistCreate(_Blankable):
    artist_type: ArtistType
    name: Name
    manager_partner_id: int | None = None
    contact_name: ShortText | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    iban: ShortText | None = None
    default_cost: Amount | None = None
    cost_currency: Currency = Currency.TRY
    default_price: Amount | None = None
    price_currency: Currency = Currency.TRY
    notes: LongText | None = None

    _iban = field_validator("iban")(_normalize_iban)


class ArtistUpdate(_Blankable):
    artist_type: ArtistType | None = None
    name: Name | None = None
    manager_partner_id: int | None = None
    contact_name: ShortText | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    iban: ShortText | None = None
    default_cost: Amount | None = None
    cost_currency: Currency | None = None
    default_price: Amount | None = None
    price_currency: Currency | None = None
    notes: LongText | None = None
    is_active: bool | None = None

    _iban = field_validator("iban")(_normalize_iban)


class RiderItemRead(ApiModel):
    id: int
    category: RiderCategory
    title: str
    description: str | None
    is_required: bool
    sort_order: int
    is_active: bool


class ArtistRead(ApiModel):
    id: int
    artist_type: ArtistType
    name: str
    manager_partner_id: int | None
    manager_partner_name: str | None
    contact_name: str | None
    phone: str | None
    email: str | None
    iban: str | None
    # Maliyet bilgileri yetkisi olmayana (operasyon) None döner.
    default_cost: Decimal | None
    cost_currency: Currency | None
    default_price: Decimal | None
    price_currency: Currency
    notes: str | None
    is_active: bool


class ArtistDetail(ArtistRead):
    rider_items: list[RiderItemRead]


class RiderItemCreate(_Blankable):
    category: RiderCategory
    title: Name
    description: LongText | None = None
    is_required: bool = True
    sort_order: int = 0


class RiderItemUpdate(_Blankable):
    category: RiderCategory | None = None
    title: Name | None = None
    description: LongText | None = None
    is_required: bool | None = None
    sort_order: int | None = None
    is_active: bool | None = None


# --- Hizmet ---


class ServiceCreate(_Blankable):
    service_type: ServiceType
    name: Name
    unit: ServiceUnit = ServiceUnit.PIECE
    supplier_id: int | None = None
    default_cost: Amount | None = None
    cost_currency: Currency = Currency.TRY
    default_price: Amount | None = None
    price_currency: Currency = Currency.TRY
    notes: LongText | None = None


class ServiceUpdate(_Blankable):
    service_type: ServiceType | None = None
    name: Name | None = None
    unit: ServiceUnit | None = None
    supplier_id: int | None = None
    default_cost: Amount | None = None
    cost_currency: Currency | None = None
    default_price: Amount | None = None
    price_currency: Currency | None = None
    notes: LongText | None = None
    is_active: bool | None = None


class ServiceRead(ApiModel):
    id: int
    service_type: ServiceType
    name: str
    unit: ServiceUnit
    supplier_id: int | None
    supplier_name: str | None
    default_cost: Decimal | None
    cost_currency: Currency | None
    default_price: Decimal | None
    price_currency: Currency
    notes: str | None
    is_active: bool


# --- Paket ---


class PackageCreate(_Blankable):
    package_type: PackageType
    name: Name
    description: LongText | None = None
    internal_notes: LongText | None = None
    price: Amount
    currency: Currency = Currency.TRY


class PackageUpdate(_Blankable):
    package_type: PackageType | None = None
    name: Name | None = None
    description: LongText | None = None
    internal_notes: LongText | None = None
    price: Amount | None = None
    currency: Currency | None = None
    is_active: bool | None = None


class PackageListItem(ApiModel):
    id: int
    package_type: PackageType
    name: str
    description: str | None
    price: Decimal
    currency: Currency
    item_count: int
    is_active: bool


class PackageItemCreate(_Blankable):
    component_type: ComponentType
    artist_id: int | None = None
    service_id: int | None = None
    title: ShortText | None = None
    program_section: ProgramSection = ProgramSection.MAIN
    start_time: time | None = None
    end_time: time | None = None
    quantity: Quantity = Decimal("1")
    # Verilmezse sanatçının/hizmetin varsayılan maliyeti kullanılır.
    unit_cost: Amount | None = None
    cost_currency: Currency | None = None
    is_visible_on_offer: bool = True
    sort_order: int | None = None
    notes: LongText | None = None

    @model_validator(mode="after")
    def check_component(self) -> "PackageItemCreate":
        if self.component_type == ComponentType.ARTIST and (
            self.artist_id is None or self.service_id is not None
        ):
            raise ValueError("Sanatçı kalemi için sadece sanatçı seçilmelidir.")
        if self.component_type == ComponentType.SERVICE and (
            self.service_id is None or self.artist_id is not None
        ):
            raise ValueError("Hizmet kalemi için sadece hizmet seçilmelidir.")
        if self.component_type == ComponentType.CUSTOM:
            if self.artist_id is not None or self.service_id is not None:
                raise ValueError("Serbest kalemde sanatçı veya hizmet seçilmez.")
            if not self.title:
                raise ValueError("Serbest kalem için başlık zorunludur.")
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("Başlangıç ve bitiş saati birlikte girilmelidir.")
        return self


class PackageItemUpdate(_Blankable):
    title: ShortText | None = None
    program_section: ProgramSection | None = None
    start_time: time | None = None
    end_time: time | None = None
    quantity: Quantity | None = None
    unit_cost: Amount | None = None
    cost_currency: Currency | None = None
    is_visible_on_offer: bool | None = None
    sort_order: int | None = None
    notes: LongText | None = None


class PackageItemRead(ApiModel):
    id: int
    component_type: ComponentType
    artist_id: int | None
    service_id: int | None
    title: str
    program_section: ProgramSection
    start_time: time | None
    end_time: time | None
    quantity: Decimal
    unit_cost: Decimal | None
    cost_currency: Currency | None
    total_cost: Decimal | None
    is_visible_on_offer: bool
    sort_order: int
    notes: str | None
    source_is_active: bool


class PackageSummary(ApiModel):
    """İç kârlılık özeti. Farklı para birimindeki maliyetler kur olmadan toplanmaz."""

    price: MoneyValue
    costs: list[MoneyValue]
    gross_profit: Decimal | None
    margin_percent: Decimal | None
    needs_exchange_rate: bool


class PackageDetail(ApiModel):
    id: int
    package_type: PackageType
    name: str
    description: str | None
    internal_notes: str | None
    price: Decimal
    currency: Currency
    is_active: bool
    items: list[PackageItemRead]
    summary: PackageSummary | None  # maliyet yetkisi yoksa None
