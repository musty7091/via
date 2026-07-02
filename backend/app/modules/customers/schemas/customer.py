from datetime import datetime

from pydantic import BaseModel, EmailStr


class CustomerBase(BaseModel):
    customer_type: str = "company"
    customer_status: str = "active"
    name: str
    short_name: str | None = None
    tax_number: str | None = None
    tax_office: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    website: str | None = None
    country: str | None = None
    city: str | None = None
    district: str | None = None
    address: str | None = None
    default_invoice_type: str | None = "select_on_event"
    default_currency: str = "TRY"
    default_payment_term_days: int | None = None
    risk_level: str = "normal"
    risk_note: str | None = None
    is_active: bool = True
    notes: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    customer_type: str | None = None
    customer_status: str | None = None
    name: str | None = None
    short_name: str | None = None
    tax_number: str | None = None
    tax_office: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    website: str | None = None
    country: str | None = None
    city: str | None = None
    district: str | None = None
    address: str | None = None
    default_invoice_type: str | None = None
    default_currency: str | None = None
    default_payment_term_days: int | None = None
    risk_level: str | None = None
    risk_note: str | None = None
    is_active: bool | None = None
    notes: str | None = None


class CustomerRead(CustomerBase):
    id: int
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }


class CustomerListItem(BaseModel):
    id: int
    customer_type: str
    customer_status: str
    name: str
    short_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    city: str | None = None
    default_currency: str
    risk_level: str
    is_active: bool
    created_at: datetime

    model_config = {
        "from_attributes": True
    }
