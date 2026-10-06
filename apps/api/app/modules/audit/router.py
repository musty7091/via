from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.core.deps import DbSession, require
from app.core.permissions import Permission
from app.core.schemas import ApiModel, Page, columns
from app.modules.audit.models import AuditLog

router = APIRouter(prefix="/audit-logs", tags=["audit"])


class AuditLogRead(ApiModel):
    id: int
    occurred_at: datetime
    user_id: int | None
    user_name: str | None
    action: str
    entity_type: str
    entity_id: int | None
    summary: str
    changes: dict[str, Any] | None
    ip_address: str | None


@router.get(
    "",
    response_model=Page[AuditLogRead],
    dependencies=[Depends(require(Permission.AUDIT_VIEW))],
)
def list_audit_logs(
    db: DbSession,
    entity_type: str | None = None,
    entity_id: int | None = None,
    user_id: int | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> Page[AuditLogRead]:
    query = select(AuditLog)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        query = query.where(AuditLog.entity_id == entity_id)
    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
    if search:
        query = query.where(AuditLog.summary.ilike(f"%{search}%"))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc()).offset(offset).limit(limit)
    ).all()
    return Page(
        items=[
            AuditLogRead.model_validate(
                {**columns(row), "user_name": row.user.full_name if row.user else None}
            )
            for row in rows
        ],
        total=total,
    )
