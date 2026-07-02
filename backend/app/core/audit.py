"""
Denetim (audit) günlüğü.

Değiştirici (POST/PUT/PATCH/DELETE) her istek `audit_logs` tablosuna yazılır:
kim (user_id), ne (action=method), nerede (table_name=kaynak, record_id),
tam yol ve sonuç (new_value), IP ve tarayıcı bilgisi.

Not: Denetim kaydı ASLA isteği bozmaz; her şey try/except içindedir.
"""

import json
import re

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.security import decode_access_token
from app.db.database import SessionLocal
from app.models.system import AuditLog

_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_ID_IN_PATH = re.compile(r"/(\d+)(?=/|$)")

# Gürültü / hassas yolları denetim dışında tut
_SKIP_PREFIXES = (
    "/api/v1/auth/login",  # şifre gövdede; ayrıca çok sık
)


def _extract_user_id(request: Request) -> int | None:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload:
        return None
    sub = payload.get("sub")
    try:
        return int(sub) if sub is not None else None
    except (TypeError, ValueError):
        return None


def _resource_and_record(path: str) -> tuple[str, int | None]:
    # /api/v1/offers/5/items -> table_name="offers", record_id=5
    trimmed = path
    for prefix in ("/api/v1/",):
        if trimmed.startswith(prefix):
            trimmed = trimmed[len(prefix):]
            break
    resource = trimmed.split("/", 1)[0] if trimmed else path
    match = _ID_IN_PATH.search(path)
    record_id = int(match.group(1)) if match else None
    return resource or path, record_id


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        try:
            method = request.method.upper()
            path = request.url.path
            if method in _MUTATING_METHODS and path.startswith("/api/v1/") and not any(
                path.startswith(p) for p in _SKIP_PREFIXES
            ):
                self._write_audit(request, response.status_code)
        except Exception as exc:  # denetim asla isteği bozmaz
            print(f"[audit] kayıt atlandı: {exc}")

        return response

    def _write_audit(self, request: Request, status_code: int) -> None:
        user_id = _extract_user_id(request)
        resource, record_id = _resource_and_record(request.url.path)
        client_ip = None
        if request.client:
            client_ip = request.client.host
        # Proxy arkasındaysa gerçek IP
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()

        detail = json.dumps(
            {
                "method": request.method.upper(),
                "path": request.url.path,
                "status": status_code,
            },
            ensure_ascii=False,
        )

        db = SessionLocal()
        try:
            db.add(
                AuditLog(
                    user_id=user_id,
                    action=request.method.upper(),
                    table_name=resource,
                    record_id=record_id,
                    old_value=None,
                    new_value=detail,
                    ip_address=client_ip,
                    user_agent=request.headers.get("user-agent"),
                )
            )
            db.commit()
        finally:
            db.close()
