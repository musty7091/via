from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.utils.money import Money, OptMoney


class ArtistBase(BaseModel):
    artist_type: str = "solo_artist"
    name: str
    manager_partner_id: int | None = None
    default_cost_amount: Money = Field(default=Decimal("0"), ge=0)
    default_cost_currency: str = "TRY"
    default_sale_amount: Money = Field(default=Decimal("0"), ge=0)
    default_sale_currency: str = "TRY"
    notes: str | None = None
    is_active: bool = True


class ArtistCreate(ArtistBase):
    pass


class ArtistUpdate(BaseModel):
    artist_type: str | None = None
    name: str | None = None
    manager_partner_id: int | None = None
    default_cost_amount: OptMoney = Field(default=None, ge=0)
    default_cost_currency: str | None = None
    default_sale_amount: OptMoney = Field(default=None, ge=0)
    default_sale_currency: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class ArtistRead(ArtistBase):
    id: int
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class ArtistRiderTemplateItemBase(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    sort_order: int = 0
    is_required: bool = True
    is_active: bool = True


class ArtistRiderTemplateItemCreate(ArtistRiderTemplateItemBase):
    pass


class ArtistRiderTemplateItemRead(ArtistRiderTemplateItemBase):
    id: int
    artist_id: int
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }
