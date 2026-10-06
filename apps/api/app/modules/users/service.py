from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import RequestContext
from app.core.errors import ConflictError, DomainError, NotFoundError
from app.core.permissions import ROLE_LABELS, Role
from app.core.security import hash_password
from app.modules.audit import service as audit
from app.modules.partners.models import Partner
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate, UserRead, UserUpdate

AUDIT_FIELDS = ["full_name", "email", "role", "is_active"]


def to_read(db: Session, user: User) -> UserRead:
    partner = db.scalar(select(Partner).where(Partner.user_id == user.id))
    return UserRead(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        role_label=ROLE_LABELS[Role(user.role)],
        is_active=user.is_active,
        is_locked=bool(user.locked_until and user.locked_until > datetime.now(UTC)),
        partner_id=partner.id if partner else None,
        partner_name=partner.full_name if partner else None,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


def get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("Kullanıcı bulunamadı.")
    return user


def list_users(
    db: Session, *, search: str | None, is_active: bool | None, offset: int, limit: int
) -> tuple[list[User], int]:
    query = select(User)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    users = db.scalars(query.order_by(User.full_name).offset(offset).limit(limit)).all()
    return list(users), total


def _ensure_email_free(db: Session, email: str, exclude_id: int | None = None) -> None:
    query = select(User.id).where(User.email == email)
    if exclude_id is not None:
        query = query.where(User.id != exclude_id)
    if db.scalar(query) is not None:
        raise ConflictError("Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var.")


def _active_admin_count(db: Session, exclude_id: int) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == Role.SUPER_ADMIN, User.is_active.is_(True), User.id != exclude_id)
        )
        or 0
    )


def create_user(
    db: Session, data: UserCreate, *, actor: User | None, context: RequestContext | None
) -> User:
    _ensure_email_free(db, data.email)
    user = User(
        full_name=data.full_name,
        email=data.email,
        role=data.role,
        is_active=data.is_active,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="user.create",
        entity_type="user",
        entity_id=user.id,
        summary=f"{user.full_name} kullanıcısı oluşturuldu ({ROLE_LABELS[data.role]}).",
        changes=audit.snapshot(user, AUDIT_FIELDS),
        context=context,
    )
    db.commit()
    return user


def update_user(
    db: Session, user: User, data: UserUpdate, *, actor: User, context: RequestContext
) -> User:
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        return user

    losing_admin = user.role == Role.SUPER_ADMIN and (
        changes.get("role", Role.SUPER_ADMIN) != Role.SUPER_ADMIN
        or changes.get("is_active") is False
    )
    if user.id == actor.id and losing_admin:
        raise DomainError("Kendi yönetici yetkinizi kaldıramaz veya hesabınızı pasife alamazsınız.")
    if losing_admin and _active_admin_count(db, exclude_id=user.id) == 0:
        raise DomainError("Sistemde en az bir aktif yönetici kalmalıdır.")
    if "email" in changes:
        _ensure_email_free(db, changes["email"], exclude_id=user.id)

    before = audit.snapshot(user, AUDIT_FIELDS)
    for field, value in changes.items():
        setattr(user, field, value)
    if changes.get("is_active") is False or (
        "role" in changes and before["role"] != changes["role"]
    ):
        # Pasife alınan veya rolü değişen kullanıcı yeniden giriş yapmak zorunda kalır.
        user.token_version += 1

    after = audit.snapshot(user, AUDIT_FIELDS)
    audit.record(
        db,
        actor=actor,
        action="user.update",
        entity_type="user",
        entity_id=user.id,
        summary=f"{user.full_name} kullanıcısı güncellendi.",
        changes=audit.diff(before, after),
        context=context,
    )
    db.commit()
    return user


def reset_password(
    db: Session, user: User, new_password: str, *, actor: User, context: RequestContext
) -> None:
    user.password_hash = hash_password(new_password)
    user.token_version += 1
    user.failed_login_count = 0
    user.locked_until = None
    audit.record(
        db,
        actor=actor,
        action="user.reset_password",
        entity_type="user",
        entity_id=user.id,
        summary=f"{user.full_name} kullanıcısının şifresi sıfırlandı.",
        context=context,
    )
    db.commit()
