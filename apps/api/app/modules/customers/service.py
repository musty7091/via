from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.deps import RequestContext
from app.core.errors import DomainError, NotFoundError
from app.core.schemas import columns
from app.core.text import fold, search_pattern
from app.core.updates import update_values
from app.modules.audit import service as audit
from app.modules.customers.models import Customer, CustomerContact, CustomerType, Venue
from app.modules.customers.schemas import (
    ContactCreate,
    ContactRead,
    ContactUpdate,
    CustomerCreate,
    CustomerListItem,
    CustomerRead,
    CustomerUpdate,
    VenueCreate,
    VenueRead,
    VenueUpdate,
)
from app.modules.users.models import User

CUSTOMER_FIELDS = list(CustomerUpdate.model_fields)
CUSTOMER_REQUIRED = {"customer_type", "name", "default_currency", "risk_level", "is_active"}
CONTACT_FIELDS = list(ContactUpdate.model_fields)
CONTACT_REQUIRED = {"full_name", "is_primary", "is_accounting", "is_operation", "is_active"}
VENUE_FIELDS = list(VenueUpdate.model_fields)
VENUE_REQUIRED = {"name", "venue_type", "is_active"}


def _customer_search_text(customer: Customer) -> str:
    return fold(
        customer.name,
        customer.short_name,
        customer.tax_number,
        customer.phone,
        customer.email,
        customer.city,
    )


def _venue_search_text(venue: Venue) -> str:
    return fold(venue.name, venue.city, venue.district, venue.contact_name)


# --- Okuma ---


def get_customer(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise NotFoundError("Müşteri bulunamadı.")
    return customer


def venue_read(venue: Venue) -> VenueRead:
    return VenueRead.model_validate(
        {**columns(venue), "customer_name": venue.customer.name if venue.customer else None}
    )


def customer_read(db: Session, customer: Customer) -> CustomerRead:
    venues = db.scalars(
        select(Venue).where(Venue.customer_id == customer.id).order_by(Venue.name)
    ).all()
    return CustomerRead.model_validate(
        {
            **columns(customer),
            "contacts": [ContactRead.model_validate(c) for c in customer.contacts],
            "venues": [venue_read(v) for v in venues],
        }
    )


def list_customers(
    db: Session,
    *,
    search: str | None,
    customer_type: CustomerType | None,
    is_active: bool | None,
    offset: int,
    limit: int,
) -> tuple[list[CustomerListItem], int]:
    query = select(Customer)
    if search:
        query = query.where(Customer.search_text.like(search_pattern(search)))
    if customer_type:
        query = query.where(Customer.customer_type == customer_type)
    if is_active is not None:
        query = query.where(Customer.is_active == is_active)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    customers = db.scalars(query.order_by(Customer.name).offset(offset).limit(limit)).all()

    primary = {
        contact.customer_id: contact
        for contact in db.scalars(
            select(CustomerContact).where(
                CustomerContact.customer_id.in_([c.id for c in customers]),
                CustomerContact.is_primary.is_(True),
                CustomerContact.is_active.is_(True),
            )
        )
    }
    items = [
        CustomerListItem.model_validate(
            {
                **columns(customer),
                "primary_contact_name": primary[customer.id].full_name
                if customer.id in primary
                else None,
                "primary_contact_phone": primary[customer.id].phone
                if customer.id in primary
                else None,
            }
        )
        for customer in customers
    ]
    return items, total


# --- Müşteri yazma ---


def create_customer(
    db: Session, data: CustomerCreate, *, actor: User, context: RequestContext
) -> Customer:
    customer = Customer(**data.model_dump())
    customer.search_text = _customer_search_text(customer)
    db.add(customer)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="customer.create",
        entity_type="customer",
        entity_id=customer.id,
        summary=f"{customer.name} müşterisi oluşturuldu.",
        changes=audit.snapshot(customer, CUSTOMER_FIELDS),
        context=context,
    )
    db.commit()
    return customer


def update_customer(
    db: Session, customer: Customer, data: CustomerUpdate, *, actor: User, context: RequestContext
) -> Customer:
    changes = update_values(data, CUSTOMER_REQUIRED)
    if not changes:
        return customer
    diff = audit.apply_changes(customer, changes, CUSTOMER_FIELDS)
    customer.search_text = _customer_search_text(customer)
    audit.record(
        db,
        actor=actor,
        action="customer.update",
        entity_type="customer",
        entity_id=customer.id,
        summary=f"{customer.name} müşterisi güncellendi.",
        changes=diff,
        context=context,
    )
    db.commit()
    return customer


# --- Yetkililer ---


def _clear_other_primary(db: Session, customer_id: int, keep_id: int) -> None:
    db.execute(
        update(CustomerContact)
        .where(CustomerContact.customer_id == customer_id, CustomerContact.id != keep_id)
        .values(is_primary=False)
    )


def get_contact(db: Session, customer: Customer, contact_id: int) -> CustomerContact:
    contact = db.get(CustomerContact, contact_id)
    if contact is None or contact.customer_id != customer.id:
        raise NotFoundError("Yetkili bulunamadı.")
    return contact


def create_contact(
    db: Session, customer: Customer, data: ContactCreate, *, actor: User, context: RequestContext
) -> CustomerContact:
    has_primary = db.scalar(
        select(CustomerContact.id).where(
            CustomerContact.customer_id == customer.id, CustomerContact.is_primary.is_(True)
        )
    )
    contact = CustomerContact(customer_id=customer.id, **data.model_dump())
    # Müşterinin ilk yetkilisi otomatik olarak ana yetkili olur.
    contact.is_primary = contact.is_primary or has_primary is None
    db.add(contact)
    db.flush()
    if contact.is_primary:
        _clear_other_primary(db, customer.id, contact.id)
    audit.record(
        db,
        actor=actor,
        action="customer_contact.create",
        entity_type="customer",
        entity_id=customer.id,
        summary=f"{customer.name} müşterisine {contact.full_name} yetkili olarak eklendi.",
        changes=audit.snapshot(contact, CONTACT_FIELDS),
        context=context,
    )
    db.commit()
    db.refresh(customer)
    return contact


def update_contact(
    db: Session,
    customer: Customer,
    contact: CustomerContact,
    data: ContactUpdate,
    *,
    actor: User,
    context: RequestContext,
) -> CustomerContact:
    changes = update_values(data, CONTACT_REQUIRED)
    if not changes:
        return contact
    if changes.get("is_active") is False:
        changes["is_primary"] = False
    diff = audit.apply_changes(contact, changes, CONTACT_FIELDS)
    if contact.is_primary:
        if not contact.is_active:
            raise DomainError("Pasif yetkili ana yetkili olamaz.")
        _clear_other_primary(db, customer.id, contact.id)
    audit.record(
        db,
        actor=actor,
        action="customer_contact.update",
        entity_type="customer",
        entity_id=customer.id,
        summary=f"{customer.name} müşterisinin yetkilisi {contact.full_name} güncellendi.",
        changes=diff,
        context=context,
    )
    db.commit()
    db.refresh(customer)
    return contact


# --- Mekânlar ---


def get_venue(db: Session, venue_id: int) -> Venue:
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise NotFoundError("Mekân bulunamadı.")
    return venue


def _ensure_customer_exists(db: Session, customer_id: int | None) -> None:
    if customer_id is not None and db.get(Customer, customer_id) is None:
        raise DomainError("Bağlanmak istenen müşteri bulunamadı.")


def list_venues(
    db: Session,
    *,
    search: str | None,
    customer_id: int | None,
    is_active: bool | None,
    offset: int,
    limit: int,
) -> tuple[list[Venue], int]:
    query = select(Venue)
    if search:
        query = query.where(Venue.search_text.like(search_pattern(search)))
    if customer_id is not None:
        query = query.where(Venue.customer_id == customer_id)
    if is_active is not None:
        query = query.where(Venue.is_active == is_active)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    venues = db.scalars(query.order_by(Venue.name).offset(offset).limit(limit)).all()
    return list(venues), total


def create_venue(db: Session, data: VenueCreate, *, actor: User, context: RequestContext) -> Venue:
    _ensure_customer_exists(db, data.customer_id)
    venue = Venue(**data.model_dump())
    venue.search_text = _venue_search_text(venue)
    db.add(venue)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="venue.create",
        entity_type="venue",
        entity_id=venue.id,
        summary=f"{venue.name} mekânı oluşturuldu.",
        changes=audit.snapshot(venue, VENUE_FIELDS),
        context=context,
    )
    db.commit()
    db.refresh(venue)
    return venue


def update_venue(
    db: Session, venue: Venue, data: VenueUpdate, *, actor: User, context: RequestContext
) -> Venue:
    changes = update_values(data, VENUE_REQUIRED)
    if not changes:
        return venue
    if "customer_id" in changes:
        _ensure_customer_exists(db, changes["customer_id"])
    diff = audit.apply_changes(venue, changes, VENUE_FIELDS)
    venue.search_text = _venue_search_text(venue)
    audit.record(
        db,
        actor=actor,
        action="venue.update",
        entity_type="venue",
        entity_id=venue.id,
        summary=f"{venue.name} mekânı güncellendi.",
        changes=diff,
        context=context,
    )
    db.commit()
    db.refresh(venue)
    return venue
