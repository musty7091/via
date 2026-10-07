from datetime import datetime
from typing import Annotated

from pydantic import EmailStr, Field, StringConstraints, field_validator

from app.core.permissions import ROLE_LABELS, Role
from app.core.schemas import ApiModel
from app.core.security import MIN_PASSWORD_LENGTH

FullName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Password = Annotated[str, Field(min_length=MIN_PASSWORD_LENGTH, max_length=128)]


def _lower(value: str | None) -> str | None:
    return value.strip().lower() if value else value


class UserRead(ApiModel):
    id: int
    full_name: str
    email: str
    role: Role
    role_label: str
    is_active: bool
    is_locked: bool
    must_change_password: bool
    partner_id: int | None
    partner_name: str | None
    last_login_at: datetime | None
    created_at: datetime


class UserCreate(ApiModel):
    full_name: FullName
    email: EmailStr
    role: Role
    password: Password
    is_active: bool = True

    _normalize_email = field_validator("email")(_lower)


class UserUpdate(ApiModel):
    full_name: FullName | None = None
    email: EmailStr | None = None
    role: Role | None = None
    is_active: bool | None = None

    _normalize_email = field_validator("email")(_lower)


class PasswordReset(ApiModel):
    new_password: Password


class RoleOption(ApiModel):
    value: Role
    label: str


ROLE_OPTIONS = [RoleOption(value=role, label=ROLE_LABELS[role]) for role in Role]
