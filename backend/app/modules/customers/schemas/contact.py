from datetime import datetime

from pydantic import BaseModel, EmailStr


class CustomerContactBase(BaseModel):
    full_name: str
    title: str | None = None
    contact_role: str | None = None
    phone: str | None = None
    whatsapp_phone: str | None = None
    email: EmailStr | None = None
    is_primary_contact: bool = False
    is_accounting_contact: bool = False
    is_operation_contact: bool = False
    is_active: bool = True
    notes: str | None = None


class CustomerContactCreate(CustomerContactBase):
    pass


class CustomerContactRead(CustomerContactBase):
    id: int
    customer_id: int
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }
