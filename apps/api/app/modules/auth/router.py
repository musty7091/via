from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Response, status
from pydantic import EmailStr
from sqlalchemy import select

from app.core.config import get_settings
from app.core.deps import Context, CurrentUser, DbSession
from app.core.errors import DomainError, TooManyRequestsError
from app.core.permissions import permissions_for
from app.core.ratelimit import SlidingWindow
from app.core.schemas import ApiModel
from app.core.security import (
    SESSION_COOKIE,
    create_access_token,
    hash_password,
    verify_password,
)
from app.modules.audit import service as audit
from app.modules.users import service as user_service
from app.modules.users.models import User
from app.modules.users.schemas import Password, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_FAILED_LOGINS = 5
LOCK_DURATION = timedelta(minutes=15)
INVALID_CREDENTIALS = "E-posta veya şifre hatalı."
# Aynı IP'den 15 dakikada en fazla 20 hatalı giriş.
failed_logins_by_ip = SlidingWindow(limit=20, seconds=15 * 60)


class LoginRequest(ApiModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(ApiModel):
    current_password: str
    new_password: Password


class Me(UserRead):
    permissions: list[str]


def _me(db: DbSession, user: User) -> Me:
    return Me(
        **user_service.to_read(db, user).model_dump(),
        permissions=sorted(permissions_for(user.role)),
    )


def _set_session_cookie(response: Response, user: User) -> None:
    token, expires_at = create_access_token(user.id, user.token_version)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        expires=expires_at,
        httponly=True,
        secure=get_settings().environment == "production",
        samesite="lax",
        path="/",
    )


@router.post("/login", response_model=Me)
def login(data: LoginRequest, response: Response, db: DbSession, context: Context) -> Me:
    ip_key = context.ip_address or "unknown"
    if failed_logins_by_ip.blocked(ip_key):
        raise TooManyRequestsError(
            "Bu bağlantıdan çok fazla hatalı giriş denendi. Lütfen 15 dakika sonra tekrar deneyin."
        )
    now = datetime.now(UTC)
    user = db.scalar(select(User).where(User.email == data.email.strip().lower()))

    if user and user.locked_until and user.locked_until > now:
        failed_logins_by_ip.hit(ip_key)
        raise DomainError(
            "Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.",
            code="account_locked",
        )

    if not verify_password(data.password, user.password_hash if user else None) or not user:
        failed_logins_by_ip.hit(ip_key)
        if user:
            user.failed_login_count += 1
            if user.failed_login_count >= MAX_FAILED_LOGINS:
                user.locked_until = now + LOCK_DURATION
                user.failed_login_count = 0
                audit.record(
                    db,
                    actor=user,
                    action="auth.locked",
                    entity_type="user",
                    entity_id=user.id,
                    summary=f"{user.full_name} hesabı hatalı denemeler yüzünden kilitlendi.",
                    context=context,
                )
            db.commit()
        raise DomainError(INVALID_CREDENTIALS, code="invalid_credentials")

    if not user.is_active:
        raise DomainError("Bu hesap pasif durumda. Yöneticinizle görüşün.", code="inactive")

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    audit.record(
        db,
        actor=user,
        action="auth.login",
        entity_type="user",
        entity_id=user.id,
        summary=f"{user.full_name} giriş yaptı.",
        context=context,
    )
    db.commit()
    _set_session_cookie(response, user)
    return _me(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me", response_model=Me)
def me(db: DbSession, user: CurrentUser) -> Me:
    return _me(db, user)


@router.post("/change-password", response_model=Me)
def change_password(
    data: ChangePasswordRequest,
    response: Response,
    db: DbSession,
    user: CurrentUser,
    context: Context,
) -> Me:
    if not verify_password(data.current_password, user.password_hash):
        raise DomainError("Mevcut şifre hatalı.", code="invalid_password")
    user.password_hash = hash_password(data.new_password)
    user.token_version += 1
    audit.record(
        db,
        actor=user,
        action="auth.change_password",
        entity_type="user",
        entity_id=user.id,
        summary=f"{user.full_name} şifresini değiştirdi.",
        context=context,
    )
    db.commit()
    # Diğer cihazlardaki oturumlar kapanır; bu cihaz yeni oturumla devam eder.
    _set_session_cookie(response, user)
    return _me(db, user)
