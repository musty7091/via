from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.events.schemas import EventDetail, EventRead, EventStatusUpdate
from app.modules.events.services import event_service

router = APIRouter(prefix="/events", tags=["Events"])


@router.get("", response_model=list[EventRead])
def list_events(
    search: str | None = Query(default=None),
    customer_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return event_service.list_events(
        db=db,
        search=search,
        customer_id=customer_id,
        status=status,
        skip=skip,
        limit=limit,
    )


@router.get("/{event_id}/detail", response_model=EventDetail)
def get_event_detail(
    event_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return event_service.get_event_detail(db=db, event_id=event_id)


@router.patch("/{event_id}/status", response_model=EventRead)
def update_event_status(
    event_id: int,
    payload: EventStatusUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Etkinliğin operasyonel durumunu günceller (ör. 'completed' = Tamamlandı)."""
    return event_service.update_event_status(
        db=db,
        event_id=event_id,
        new_status=payload.status,
    )
