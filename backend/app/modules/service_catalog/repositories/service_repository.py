from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.artist import ServiceItem


def get_service_item(db: Session, service_item_id: int) -> ServiceItem | None:
    return db.get(ServiceItem, service_item_id)


def list_service_items(
    db: Session,
    search: str | None = None,
    service_type: str | None = None,
    is_active: bool | None = True,
    skip: int = 0,
    limit: int = 100,
) -> list[ServiceItem]:
    query = db.query(ServiceItem)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                ServiceItem.name.ilike(term),
                ServiceItem.notes.ilike(term),
            )
        )

    if service_type:
        query = query.filter(ServiceItem.service_type == service_type)

    if is_active is not None:
        query = query.filter(ServiceItem.is_active == is_active)

    return query.order_by(ServiceItem.name.asc()).offset(skip).limit(limit).all()


def create_service_item(db: Session, data: dict) -> ServiceItem:
    service_item = ServiceItem(**data)
    db.add(service_item)
    db.commit()
    db.refresh(service_item)
    return service_item


def update_service_item(db: Session, service_item: ServiceItem, data: dict) -> ServiceItem:
    for key, value in data.items():
        setattr(service_item, key, value)

    db.commit()
    db.refresh(service_item)
    return service_item
