from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path
from pydantic import Field

from app.core.deps import Context, DbSession, require
from app.core.permissions import Permission
from app.core.schemas import ApiModel
from app.modules.closing import events as event_closing
from app.modules.closing import periods
from app.modules.events.service import get_event
from app.modules.users.models import User

router = APIRouter(prefix="/closing", tags=["closing"])

Viewer = Annotated[User, Depends(require(Permission.FINANCE_VIEW))]
Approver = Annotated[User, Depends(require(Permission.FINANCE_APPROVE))]
Closer = Annotated[User, Depends(require(Permission.PERIOD_CLOSE))]
Reopener = Annotated[User, Depends(require(Permission.PERIOD_REOPEN))]
Month = Annotated[str, Path(pattern=r"^\d{4}-\d{2}$")]


class Reason(ApiModel):
    reason: Annotated[str, Field(min_length=3, max_length=1000)]


class Note(ApiModel):
    note: Annotated[str, Field(max_length=1000)] | None = None


class PeriodRow(ApiModel):
    month: str
    label: str
    status: str
    closed_at: datetime | None
    month_result: str | None


# --- Etkinlik kapanışı ---


@router.get("/events/{event_id}", response_model=event_closing.ClosurePreview)
def event_preview(event_id: int, db: DbSession, _: Viewer) -> event_closing.ClosurePreview:
    return event_closing.preview(db, get_event(db, event_id))


@router.post("/events/{event_id}/close", response_model=event_closing.ClosurePreview)
def close_event(
    event_id: int, data: Note, db: DbSession, actor: Approver, context: Context
) -> event_closing.ClosurePreview:
    event = get_event(db, event_id)
    event_closing.close_event(db, event, data.note, actor=actor, context=context)
    return event_closing.preview(db, event)


@router.post("/events/{event_id}/reopen", response_model=event_closing.ClosurePreview)
def reopen_event(
    event_id: int, data: Reason, db: DbSession, actor: Approver, context: Context
) -> event_closing.ClosurePreview:
    event = get_event(db, event_id)
    event_closing.reopen(db, event, data.reason, actor=actor, context=context)
    return event_closing.preview(db, event)


@router.post("/events/{event_id}/write-off", response_model=event_closing.ClosurePreview)
def write_off(
    event_id: int, data: Reason, db: DbSession, actor: Approver, context: Context
) -> event_closing.ClosurePreview:
    event = get_event(db, event_id)
    event_closing.write_off(db, event, data.reason, actor=actor, context=context)
    return event_closing.preview(db, event)


# --- Dönem kapanışı ---


@router.get("/periods", response_model=list[PeriodRow])
def list_periods(db: DbSession, _: Viewer) -> list[PeriodRow]:
    return [PeriodRow.model_validate(p) for p in periods.list_periods(db)]


@router.get("/periods/{month}", response_model=periods.PeriodPreview)
def period_preview(month: Month, db: DbSession, _: Viewer) -> periods.PeriodPreview:
    return periods.preview(db, month)


@router.post("/periods/{month}/close", response_model=periods.PeriodPreview)
def close_period(
    month: Month, db: DbSession, actor: Closer, context: Context
) -> periods.PeriodPreview:
    periods.close_period(db, month, actor=actor, context=context)
    return periods.preview(db, month)


@router.post("/periods/{month}/reopen", response_model=periods.PeriodPreview)
def reopen_period(
    month: Month, data: Reason, db: DbSession, actor: Reopener, context: Context
) -> periods.PeriodPreview:
    periods.reopen_period(db, month, data.reason, actor=actor, context=context)
    return periods.preview(db, month)
