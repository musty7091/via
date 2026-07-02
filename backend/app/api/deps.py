from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.database import get_db
from app.models.user import User, UserRole
from app.services.user_service import get_user_by_id

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum bilgisi bulunamadı.",
        )

    payload = decode_access_token(credentials.credentials)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş oturum.",
        )

    subject = payload.get("sub")

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz oturum içeriği.",
        )

    try:
        user_id = int(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kullanıcı bilgisi.",
        ) from exc

    user = get_user_by_id(db=db, user_id=user_id)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı bulunamadı veya pasif.",
        )

    return user


def get_current_super_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != UserRole.SUPER_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için super_admin yetkisi gerekir.",
        )

    return current_user


# --- Rol bazlı erişim (RBAC) -------------------------------------------------
# Sistem üç ana alana ayrılır: operasyon, finans, kullanıcı yönetimi.
# Her rolün her alandaki seviyesi: "write" (görür + değiştirir),
# "read" (sadece görür) veya tanımsız (erişemez).
#
# Mantık:
#   - operation : operasyonu yönetir, finansı göremez.
#   - accounting: finansı yönetir; tahsilat/gider işlemek için operasyonu GÖRÜR
#                 ama operasyon kaydı oluşturamaz/değiştiremez.
#   - partner_manager (Ortak/Yönetici): operasyon + finans yönetir.
#   - viewer    : her yeri salt görüntüler (operasyon); finans gizlidir.
#   - super_admin: her şey + kullanıcı yönetimi.

READ_METHODS = {"GET", "HEAD", "OPTIONS"}

MODULE_PERMISSIONS: dict[str, dict[str, str]] = {
    "operations": {
        UserRole.SUPER_ADMIN.value: "write",
        UserRole.PARTNER_MANAGER.value: "write",
        UserRole.OPERATION.value: "write",
        UserRole.ACCOUNTING.value: "read",
        UserRole.VIEWER.value: "read",
    },
    "finance": {
        UserRole.SUPER_ADMIN.value: "write",
        UserRole.PARTNER_MANAGER.value: "write",
        UserRole.ACCOUNTING.value: "write",
    },
    "users": {
        UserRole.SUPER_ADMIN.value: "write",
    },
}


def require_module(module: str):
    """Modüle erişimi (ve yazma yetkisini) kontrol eden bağımlılık üretir.

    - Alanda hiç yetkisi yoksa 403.
    - Salt okuma yetkisi olan rol, değişiklik (POST/PUT/PATCH/DELETE) yapamaz.
    """

    def checker(
        request: Request,
        current_user: User = Depends(get_current_user),
    ) -> User:
        level = MODULE_PERMISSIONS.get(module, {}).get(current_user.role)

        if level is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu alana erişim yetkiniz yok.",
            )

        if request.method not in READ_METHODS and level != "write":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu işlem için değişiklik yetkiniz yok (salt görüntüleme).",
            )

        return current_user

    return checker


require_operations_access = require_module("operations")
require_finance_access = require_module("finance")
require_user_admin = require_module("users")
