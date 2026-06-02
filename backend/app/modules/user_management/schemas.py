from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class ManagedUserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: UserRole = UserRole.VIEWER
    is_active: bool = True


class ManagedUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class ManagedUserPasswordReset(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)


class ManagedUserRead(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }
