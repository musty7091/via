from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.utils.money import Money, OptMoney


class ServiceItemBase(BaseModel):
    service_type: str = "technical_service"
    name: str
    default_cost_amount: Money = Field(default=Decimal("0"), ge=0)
    default_cost_currency: str = "TRY"
    default_sale_amount: Money = Field(default=Decimal("0"), ge=0)
    default_sale_currency: str = "TRY"
    notes: str | None = None
    is_active: bool = True


class ServiceItemCreate(ServiceItemBase):
    pass


class ServiceItemUpdate(BaseModel):
    service_type: str | None = None
    name: str | None = None
    default_cost_amount: OptMoney = Field(default=None, ge=0)
    default_cost_currency: str | None = None
    default_sale_amount: OptMoney = Field(default=None, ge=0)
    default_sale_currency: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class ServiceItemRead(ServiceItemBase):
    id: int
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }
