from sqlalchemy.orm import Session

from app.models.venue import Venue


def list_venues(db: Session, customer_id: int) -> list[Venue]:
    return (
        db.query(Venue)
        .filter(Venue.customer_id == customer_id)
        .order_by(Venue.name.asc())
        .all()
    )


def create_venue(db: Session, customer_id: int, data: dict) -> Venue:
    venue = Venue(customer_id=customer_id, **data)
    db.add(venue)
    db.commit()
    db.refresh(venue)
    return venue
