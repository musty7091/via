from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.offer import Offer, OfferItem


def get_offer(db: Session, offer_id: int) -> Offer | None:
    return db.get(Offer, offer_id)


def list_offers(
    db: Session,
    search: str | None = None,
    customer_id: int | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Offer]:
    query = db.query(Offer)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Offer.title.ilike(term),
                Offer.offer_no.ilike(term),
                Offer.customer_visible_notes.ilike(term),
            )
        )

    if customer_id:
        query = query.filter(Offer.customer_id == customer_id)

    if status:
        query = query.filter(Offer.status == status)
    else:
        query = query.filter(Offer.status != "cancelled")

    return query.order_by(Offer.id.desc()).offset(skip).limit(limit).all()


def create_offer(db: Session, data: dict) -> Offer:
    offer = Offer(**data)
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer


def update_offer(db: Session, offer: Offer, data: dict) -> Offer:
    for key, value in data.items():
        setattr(offer, key, value)

    db.commit()
    db.refresh(offer)
    return offer


def list_offer_items(db: Session, offer_id: int, include_inactive: bool = False) -> list[OfferItem]:
    query = db.query(OfferItem).filter(OfferItem.offer_id == offer_id)

    if not include_inactive:
        query = query.filter(OfferItem.is_active == True)  # noqa: E712

    return query.order_by(OfferItem.sort_order.asc(), OfferItem.id.asc()).all()


def create_offer_item(db: Session, data: dict) -> OfferItem:
    item = OfferItem(**data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def deactivate_offer_items(db: Session, offer_id: int) -> None:
    items = db.query(OfferItem).filter(OfferItem.offer_id == offer_id).all()

    for item in items:
        item.is_active = False

    db.commit()


def get_offer_item(db: Session, offer_id: int, item_id: int) -> OfferItem | None:
    return (
        db.query(OfferItem)
        .filter(
            OfferItem.offer_id == offer_id,
            OfferItem.id == item_id,
        )
        .first()
    )


def deactivate_offer_item(db: Session, item: OfferItem) -> OfferItem:
    item.is_active = False
    db.commit()
    db.refresh(item)
    return item
