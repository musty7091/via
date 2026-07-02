from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.events.repositories import event_repository
from app.modules.events.schemas import EventDetail, EventItemRead, EventRead


def get_event_or_404(db: Session, event_id: int):
    event = event_repository.get_event(db=db, event_id=event_id)

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etkinlik dosyası bulunamadı.",
        )

    return event


def list_events(
    db: Session,
    search: str | None = None,
    customer_id: int | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
):
    return event_repository.list_events(
        db=db,
        search=search,
        customer_id=customer_id,
        status=status,
        skip=skip,
        limit=limit,
    )


def get_event_detail(db: Session, event_id: int) -> EventDetail:
    event = get_event_or_404(db=db, event_id=event_id)
    items = event_repository.list_event_items(db=db, event_id=event_id)

    return EventDetail(
        event=EventRead.model_validate(event),
        items=[EventItemRead.model_validate(item) for item in items],
    )


# Etkinliğin operasyonel durumu (finansal kapanıştan bağımsızdır)
ALLOWED_EVENT_STATUSES = {
    "draft",
    "planned",
    "preparation",
    "completed",
    "cancelled",
}


def update_event_status(db: Session, event_id: int, new_status: str) -> EventRead:
    if new_status not in ALLOWED_EVENT_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz etkinlik durumu.",
        )

    event = get_event_or_404(db=db, event_id=event_id)

    from app.modules.finance_engine.service import assert_event_period_open

    assert_event_period_open(event)

    event.status = new_status
    db.commit()
    db.refresh(event)

    return EventRead.model_validate(event)
