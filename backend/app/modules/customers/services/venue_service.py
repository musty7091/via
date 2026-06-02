from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.customers import constants
from app.modules.customers.repositories import venue_repository
from app.modules.customers.schemas.venue import VenueCreate
from app.modules.customers.services.customer_service import get_customer_or_404


def _validate_venue_type(value: str | None) -> None:
    if value is None:
        return

    if value not in constants.VENUE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"venue_type gecersiz. Gecerli degerler: {', '.join(constants.VENUE_TYPES)}",
        )


def list_venues(db: Session, customer_id: int):
    get_customer_or_404(db=db, customer_id=customer_id)
    return venue_repository.list_venues(db=db, customer_id=customer_id)


def create_venue(db: Session, customer_id: int, payload: VenueCreate):
    get_customer_or_404(db=db, customer_id=customer_id)
    _validate_venue_type(payload.venue_type)

    return venue_repository.create_venue(
        db=db,
        customer_id=customer_id,
        data=payload.model_dump(),
    )