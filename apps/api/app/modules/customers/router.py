from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import Context, DbSession, require
from app.core.permissions import Permission
from app.core.schemas import Page
from app.modules.customers import service
from app.modules.customers.models import CustomerType
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

router = APIRouter(tags=["customers"])

Viewer = Annotated[User, Depends(require(Permission.CUSTOMERS_VIEW))]
Manager = Annotated[User, Depends(require(Permission.CUSTOMERS_MANAGE))]
Search = Annotated[str | None, Query(max_length=100)]
Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=200)]


@router.get("/customers", response_model=Page[CustomerListItem])
def list_customers(
    db: DbSession,
    _: Viewer,
    search: Search = None,
    customer_type: CustomerType | None = None,
    is_active: bool | None = True,
    offset: Offset = 0,
    limit: Limit = 25,
) -> Page[CustomerListItem]:
    items, total = service.list_customers(
        db,
        search=search,
        customer_type=customer_type,
        is_active=is_active,
        offset=offset,
        limit=limit,
    )
    return Page(items=items, total=total)


@router.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(
    data: CustomerCreate, db: DbSession, actor: Manager, context: Context
) -> CustomerRead:
    customer = service.create_customer(db, data, actor=actor, context=context)
    return service.customer_read(db, customer)


@router.get("/customers/{customer_id}", response_model=CustomerRead)
def get_customer(customer_id: int, db: DbSession, _: Viewer) -> CustomerRead:
    return service.customer_read(db, service.get_customer(db, customer_id))


@router.patch("/customers/{customer_id}", response_model=CustomerRead)
def update_customer(
    customer_id: int, data: CustomerUpdate, db: DbSession, actor: Manager, context: Context
) -> CustomerRead:
    customer = service.update_customer(
        db, service.get_customer(db, customer_id), data, actor=actor, context=context
    )
    return service.customer_read(db, customer)


@router.post(
    "/customers/{customer_id}/contacts",
    response_model=ContactRead,
    status_code=status.HTTP_201_CREATED,
)
def create_contact(
    customer_id: int, data: ContactCreate, db: DbSession, actor: Manager, context: Context
) -> ContactRead:
    customer = service.get_customer(db, customer_id)
    contact = service.create_contact(db, customer, data, actor=actor, context=context)
    return ContactRead.model_validate(contact)


@router.patch("/customers/{customer_id}/contacts/{contact_id}", response_model=ContactRead)
def update_contact(
    customer_id: int,
    contact_id: int,
    data: ContactUpdate,
    db: DbSession,
    actor: Manager,
    context: Context,
) -> ContactRead:
    customer = service.get_customer(db, customer_id)
    contact = service.get_contact(db, customer, contact_id)
    contact = service.update_contact(db, customer, contact, data, actor=actor, context=context)
    return ContactRead.model_validate(contact)


@router.get("/venues", response_model=Page[VenueRead])
def list_venues(
    db: DbSession,
    _: Viewer,
    search: Search = None,
    customer_id: int | None = None,
    is_active: bool | None = True,
    offset: Offset = 0,
    limit: Limit = 25,
) -> Page[VenueRead]:
    venues, total = service.list_venues(
        db, search=search, customer_id=customer_id, is_active=is_active, offset=offset, limit=limit
    )
    return Page(items=[service.venue_read(v) for v in venues], total=total)


@router.post("/venues", response_model=VenueRead, status_code=status.HTTP_201_CREATED)
def create_venue(data: VenueCreate, db: DbSession, actor: Manager, context: Context) -> VenueRead:
    return service.venue_read(service.create_venue(db, data, actor=actor, context=context))


@router.get("/venues/{venue_id}", response_model=VenueRead)
def get_venue(venue_id: int, db: DbSession, _: Viewer) -> VenueRead:
    return service.venue_read(service.get_venue(db, venue_id))


@router.patch("/venues/{venue_id}", response_model=VenueRead)
def update_venue(
    venue_id: int, data: VenueUpdate, db: DbSession, actor: Manager, context: Context
) -> VenueRead:
    venue = service.update_venue(
        db, service.get_venue(db, venue_id), data, actor=actor, context=context
    )
    return service.venue_read(venue)
