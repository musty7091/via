from sqlalchemy.orm import Session

from app.models.customer_account_movement import CustomerAccountMovement
from app.models.event import Event
from app.models.partner import Partner


def list_movements(
    db: Session,
    customer_id: int,
    include_cancelled: bool = False,
) -> list[CustomerAccountMovement]:
    query = db.query(CustomerAccountMovement).filter(
        CustomerAccountMovement.customer_id == customer_id
    )

    if not include_cancelled:
        query = query.filter(CustomerAccountMovement.is_cancelled == False)  # noqa: E712

    return (
        query.order_by(
            CustomerAccountMovement.movement_date.asc(),
            CustomerAccountMovement.id.asc(),
        )
        .all()
    )


def create_movement(db: Session, data: dict) -> CustomerAccountMovement:
    movement = CustomerAccountMovement(**data)
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


def get_event_titles(db: Session, event_ids: set[int]) -> dict[int, str]:
    if not event_ids:
        return {}

    rows = db.query(Event.id, Event.title).filter(Event.id.in_(event_ids)).all()
    return {row.id: row.title for row in rows}


def get_partner_names(db: Session, partner_ids: set[int]) -> dict[int, str]:
    if not partner_ids:
        return {}

    rows = db.query(Partner.id, Partner.full_name).filter(Partner.id.in_(partner_ids)).all()
    return {row.id: row.full_name for row in rows}
