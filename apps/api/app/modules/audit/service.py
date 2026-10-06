from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from typing import Any

from sqlalchemy.orm import Session

from app.core.deps import RequestContext
from app.modules.audit.models import AuditLog
from app.modules.users.models import User

# Bu alanlar işlem geçmişine asla yazılmaz.
SECRET_FIELDS = {"password", "password_hash", "token_version"}


def _plain(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime | date | time):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    return value


def snapshot(obj: object, fields: list[str]) -> dict[str, Any]:
    return {field: _plain(getattr(obj, field)) for field in fields if field not in SECRET_FIELDS}


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    """Sadece değişen alanları {alan: {"before": x, "after": y}} biçiminde döner."""
    return {
        key: {"before": before.get(key), "after": after.get(key)}
        for key in after
        if before.get(key) != after.get(key)
    }


def apply_changes(obj: object, changes: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    """Değişiklikleri nesneye uygular ve işlem geçmişi için farkı döner."""
    before = snapshot(obj, fields)
    for field, value in changes.items():
        setattr(obj, field, value)
    return diff(before, snapshot(obj, fields))


def record(
    db: Session,
    *,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    summary: str,
    changes: dict[str, Any] | None = None,
    context: RequestContext | None = None,
) -> AuditLog:
    """İşlem geçmişine kayıt ekler. Asıl işlemle aynı transaction içinde çağrılır;
    işlem geri alınırsa kayıt da geri alınır."""
    entry = AuditLog(
        user_id=actor.id if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary[:500],
        changes=changes or None,
        ip_address=context.ip_address if context else None,
        user_agent=context.user_agent if context else None,
    )
    db.add(entry)
    return entry
