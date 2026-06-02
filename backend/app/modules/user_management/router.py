from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_super_admin
from app.core.security import get_password_hash
from app.db.database import get_db
from app.models.user import User
from app.modules.user_management.schemas import (
    ManagedUserCreate,
    ManagedUserPasswordReset,
    ManagedUserRead,
    ManagedUserUpdate,
)
from app.services.user_service import create_user, get_user_by_email

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=list[ManagedUserRead])
def list_users(
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_super_admin),
):
    query = db.query(User)

    if search:
        keyword = f"%{search.strip().lower()}%"
        query = query.filter(
            (User.full_name.ilike(keyword)) | (User.email.ilike(keyword))
        )

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    return query.order_by(User.id.asc()).all()


@router.post("", response_model=ManagedUserRead, status_code=status.HTTP_201_CREATED)
def create_managed_user(
    payload: ManagedUserCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_super_admin),
):
    existing_user = get_user_by_email(db=db, email=payload.email)

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu e-posta adresiyle kayıtlı kullanıcı zaten var.",
        )

    return create_user(
        db=db,
        full_name=payload.full_name,
        email=str(payload.email),
        password=payload.password,
        role=payload.role.value,
        is_active=payload.is_active,
    )


@router.put("/{user_id}", response_model=ManagedUserRead)
def update_managed_user(
    user_id: int,
    payload: ManagedUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin),
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı.",
        )

    data = payload.model_dump(exclude_unset=True)

    if "email" in data and data["email"] is not None:
        new_email = str(data["email"]).lower().strip()
        existing_user = get_user_by_email(db=db, email=new_email)

        if existing_user is not None and existing_user.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu e-posta adresi başka bir kullanıcıda kayıtlı.",
            )

        user.email = new_email

    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"].strip()

    if "role" in data and data["role"] is not None:
        user.role = data["role"].value

    if "is_active" in data and data["is_active"] is not None:
        if user.id == current_user.id and data["is_active"] is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kendi super_admin hesabını pasif yapamazsın.",
            )

        user.is_active = data["is_active"]

    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reset-password", response_model=ManagedUserRead)
def reset_managed_user_password(
    user_id: int,
    payload: ManagedUserPasswordReset,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_super_admin),
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı.",
        )

    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    db.refresh(user)
    return user
