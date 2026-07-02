from datetime import datetime, time
from decimal import Decimal

from pydantic import BaseModel, Field

from app.utils.money import Money, OptMoney


class ServicePackageBase(BaseModel):
    package_type: str = "program"
    name: str
    description: str | None = None
    default_sale_amount: Money = Field(default=Decimal("0"), ge=0)
    default_sale_currency: str = "TRY"
    notes: str | None = None
    is_active: bool = True


class ServicePackageCreate(ServicePackageBase):
    pass


class ServicePackageUpdate(BaseModel):
    package_type: str | None = None
    name: str | None = None
    description: str | None = None
    default_sale_amount: OptMoney = Field(default=None, ge=0)
    default_sale_currency: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class ServicePackageRead(ServicePackageBase):
    id: int
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class ServicePackageItemCreate(BaseModel):
    component_type: str
    artist_id: int | None = None
    service_item_id: int | None = None
    title: str | None = None
    program_section: str | None = None
    sort_order: int = 0
    start_time: time | None = None
    end_time: time | None = None
    quantity: float = Field(default=1, gt=0)
    unit_cost_amount: Money = Field(default=Decimal("0"), ge=0)
    unit_cost_currency: str = "TRY"
    unit_sale_amount: Money = Field(default=Decimal("0"), ge=0)
    unit_sale_currency: str = "TRY"
    is_optional: bool = False
    is_visible_on_offer: bool = True
    is_active: bool = True
    notes: str | None = None


class ServicePackageItemRead(BaseModel):
    id: int
    package_id: int
    component_type: str
    artist_id: int | None = None
    artist_name: str | None = None
    service_item_id: int | None = None
    service_item_name: str | None = None
    title: str
    program_section: str | None = None
    sort_order: int
    start_time: time | None = None
    end_time: time | None = None
    quantity: float
    unit_cost_amount: Money
    unit_cost_currency: str
    unit_sale_amount: Money
    unit_sale_currency: str
    total_cost_amount: Money
    total_sale_amount: Money
    gross_profit_amount: Money
    is_optional: bool
    is_visible_on_offer: bool
    is_active: bool
    notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class ServicePackageSummary(BaseModel):
    package_id: int
    item_count: int
    total_cost_amount: Money
    total_sale_amount: Money
    gross_profit_amount: Money


class ServicePackageDetail(BaseModel):
    package: ServicePackageRead
    items: list[ServicePackageItemRead]
    summary: ServicePackageSummary
