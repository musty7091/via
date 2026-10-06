from typing import Annotated

from pydantic import EmailStr, StringConstraints, field_validator

from app.core.schemas import ApiModel

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)]


def _blank_to_none(value: object) -> object:
    return None if isinstance(value, str) and not value.strip() else value


class PartnerRead(ApiModel):
    id: int
    full_name: str
    phone: str | None
    email: str | None
    is_active: bool
    sort_order: int
    notes: str | None
    user_id: int | None
    user_name: str | None
    user_email: str | None


class PartnerCreate(ApiModel):
    full_name: Name
    phone: Phone | None = None
    email: EmailStr | None = None
    is_active: bool = True
    sort_order: int = 0
    notes: str | None = None
    user_id: int | None = None

    _blanks = field_validator("phone", "email", "notes", mode="before")(_blank_to_none)


class PartnerUpdate(ApiModel):
    full_name: Name | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    notes: str | None = None
    user_id: int | None = None

    _blanks = field_validator("phone", "email", "notes", mode="before")(_blank_to_none)
