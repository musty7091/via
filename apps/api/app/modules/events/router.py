from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.deps import Context, DbSession, require
from app.core.errors import DomainError
from app.core.permissions import Permission
from app.core.schemas import Page
from app.modules.events import service
from app.modules.events.models import EventStatus
from app.modules.events.service import EventAction, EventDetail, EventListItem, EventUpdate
from app.modules.finance.agreements import CancelRefund
from app.modules.users.models import User

router = APIRouter(prefix="/events", tags=["events"])

Viewer = Annotated[User, Depends(require(Permission.EVENTS_VIEW))]
Manager = Annotated[User, Depends(require(Permission.EVENTS_MANAGE))]


@router.get("", response_model=Page[EventListItem])
def list_events(
    db: DbSession,
    _: Viewer,
    search: Annotated[str | None, Query(max_length=100)] = None,
    status: EventStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    customer_id: int | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> Page[EventListItem]:
    items, total = service.list_events(
        db,
        search=search,
        status=status,
        date_from=date_from,
        date_to=date_to,
        customer_id=customer_id,
        offset=offset,
        limit=limit,
    )
    return Page(items=items, total=total)


@router.get("/{event_id}", response_model=EventDetail)
def get_event(event_id: int, db: DbSession, user: Viewer) -> EventDetail:
    return service.event_detail(service.get_event(db, event_id), user)


@router.patch("/{event_id}", response_model=EventDetail)
def update_event(
    event_id: int, data: EventUpdate, db: DbSession, actor: Manager, context: Context
) -> EventDetail:
    event = service.update_event(
        db, service.get_event(db, event_id), data, actor=actor, context=context
    )
    return service.event_detail(event, actor)


@router.post("/{event_id}/status", response_model=EventDetail)
def change_status(
    event_id: int, data: EventAction, db: DbSession, actor: Manager, context: Context
) -> EventDetail:
    refund = None
    if data.action == "cancel" and data.refund_amount:
        if data.refund_cash_account_id is None:
            raise DomainError("İadenin yapılacağı kasa/banka hesabını seçin.")
        refund = CancelRefund(
            amount=data.refund_amount,
            cash_account_id=data.refund_cash_account_id,
            refund_date=data.refund_date,
            rate=data.refund_rate,
        )
    event = service.change_status(
        db,
        service.get_event(db, event_id),
        data.action,
        data.note,
        actor=actor,
        context=context,
        refund=refund,
    )
    return service.event_detail(event, actor)
