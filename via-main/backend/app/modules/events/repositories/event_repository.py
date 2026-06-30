from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.event import Event, EventItem


def get_event(db: Session, event_id: int) -> Event | None:
    return db.get(Event, event_id)


def list_events(
    db: Session,
    search: str | None = None,
    customer_id: int | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Event]:
    query = db.query(Event)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Event.title.ilike(term),
                Event.event_code.ilike(term),
                Event.notes.ilike(term),
            )
        )

    if customer_id:
        query = query.filter(Event.customer_id == customer_id)

    if status:
        query = query.filter(Event.status == status)

    return query.order_by(Event.event_date.desc(), Event.id.desc()).offset(skip).limit(limit).all()


def list_event_items(db: Session, event_id: int) -> list[EventItem]:
    return (
        db.query(EventItem)
        .filter(EventItem.event_id == event_id)
        .order_by(EventItem.sort_order.asc(), EventItem.id.asc())
        .all()
    )
