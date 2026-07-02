from datetime import datetime

from pydantic import BaseModel, EmailStr


class VenueBase(BaseModel):
    name: str
    venue_type: str | None = None
    country: str | None = None
    city: str | None = None
    district: str | None = None
    address: str | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_email: EmailStr | None = None
    capacity: int | None = None
    stage_info: str | None = None
    technical_notes: str | None = None
    notes: str | None = None
    is_active: bool = True


class VenueCreate(VenueBase):
    pass


class VenueRead(VenueBase):
    id: int
    customer_id: int | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }
