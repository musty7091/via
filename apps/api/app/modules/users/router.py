from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import Context, DbSession, require
from app.core.permissions import Permission
from app.core.schemas import Page
from app.modules.users import service
from app.modules.users.models import User
from app.modules.users.schemas import (
    ROLE_OPTIONS,
    PasswordReset,
    RoleOption,
    UserCreate,
    UserRead,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])

Admin = Annotated[User, Depends(require(Permission.USERS_MANAGE))]


@router.get("/roles", response_model=list[RoleOption])
def list_roles(_: Admin) -> list[RoleOption]:
    return ROLE_OPTIONS


@router.get("", response_model=Page[UserRead])
def list_users(
    db: DbSession,
    _: Admin,
    search: Annotated[str | None, Query(max_length=100)] = None,
    is_active: bool | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> Page[UserRead]:
    users, total = service.list_users(
        db, search=search, is_active=is_active, offset=offset, limit=limit
    )
    return Page(items=[service.to_read(db, user) for user in users], total=total)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, db: DbSession, actor: Admin, context: Context) -> UserRead:
    user = service.create_user(db, data, actor=actor, context=context)
    return service.to_read(db, user)


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: DbSession, _: Admin) -> UserRead:
    return service.to_read(db, service.get_user(db, user_id))


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int, data: UserUpdate, db: DbSession, actor: Admin, context: Context
) -> UserRead:
    user = service.update_user(
        db, service.get_user(db, user_id), data, actor=actor, context=context
    )
    return service.to_read(db, user)


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    user_id: int, data: PasswordReset, db: DbSession, actor: Admin, context: Context
) -> None:
    service.reset_password(
        db, service.get_user(db, user_id), data.new_password, actor=actor, context=context
    )
