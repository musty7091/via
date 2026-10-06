from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import DomainError, PermissionDeniedError
from app.core.permissions import Permission, permissions_for
from app.core.security import SESSION_COOKIE, decode_access_token
from app.db.session import get_db
from app.modules.users.models import User

DbSession = Annotated[Session, Depends(get_db)]

CSRF_HEADER = "x-requested-with"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class UnauthenticatedError(DomainError):
    status_code = 401

    def __init__(self) -> None:
        super().__init__("Oturumunuz sona erdi. Lütfen tekrar giriş yapın.", code="unauthenticated")


def csrf_protect(request: Request) -> None:
    """Başka bir siteden gönderilen formları engeller.

    Tarayıcılar özel başlıkları başka sitelerden CORS izni olmadan gönderemez;
    bu yüzden veri değiştiren her istek bu başlığı taşımak zorundadır.
    """
    if request.method not in SAFE_METHODS and request.headers.get(CSRF_HEADER) != "via":
        raise PermissionDeniedError("Geçersiz istek kaynağı.")


@dataclass(frozen=True)
class RequestContext:
    ip_address: str | None
    user_agent: str | None


def client_ip(request: Request) -> str | None:
    """Gerçek istemci IP'si. X-Forwarded-For'un soldaki değerlerini istemci uydurabilir;
    bu yüzden sadece güvenilen vekillerin eklediği sağdaki değere bakılır."""
    hops = get_settings().trusted_proxies
    forwarded = [
        p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()
    ]
    if hops and len(forwarded) >= hops:
        return forwarded[-hops]
    return request.client.host if request.client else None


def get_request_context(request: Request) -> RequestContext:
    ip = client_ip(request)
    user_agent = request.headers.get("user-agent")
    return RequestContext(ip_address=ip, user_agent=user_agent[:300] if user_agent else None)


Context = Annotated[RequestContext, Depends(get_request_context)]


def get_current_user(request: Request, db: DbSession) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    decoded = decode_access_token(token) if token else None
    if decoded is None:
        raise UnauthenticatedError()
    user_id, token_version = decoded
    user = db.get(User, user_id)
    if user is None or not user.is_active or user.token_version != token_version:
        raise UnauthenticatedError()
    if user.locked_until and user.locked_until > datetime.now(UTC):
        raise UnauthenticatedError()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require(permission: Permission):
    """Endpoint'in istediği yetkiyi denetler. Kullanım: `user: User = Depends(require(...))`."""

    def checker(user: CurrentUser) -> User:
        if permission not in permissions_for(user.role):
            raise PermissionDeniedError()
        return user

    return checker
