from datetime import datetime

from pydantic import BaseModel, Field


class PartnerCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    ownership_percent: float = Field(default=33.3333, ge=0, le=100)
    is_active: bool = True
    notes: str | None = None


class PartnerUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    ownership_percent: float | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None
    notes: str | None = None


class PartnerRead(BaseModel):
    id: int
    user_id: int | None = None
    full_name: str
    ownership_percent: float
    is_active: bool
    notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }
