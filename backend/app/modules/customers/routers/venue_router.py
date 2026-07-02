from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.customers.schemas.venue import VenueCreate, VenueRead
from app.modules.customers.services import venue_service

router = APIRouter(prefix="/customers/{customer_id}/venues", tags=["Customer Venues"])


@router.get("", response_model=list[VenueRead])
def list_venues(
    customer_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return venue_service.list_venues(db=db, customer_id=customer_id)


@router.post("", response_model=VenueRead, status_code=status.HTTP_201_CREATED)
def create_venue(
    customer_id: int,
    payload: VenueCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return venue_service.create_venue(
        db=db,
        customer_id=customer_id,
        payload=payload,
    )
