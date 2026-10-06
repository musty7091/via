from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from pydantic import Field

from app.core.deps import Context, DbSession, require
from app.core.money import Currency
from app.core.permissions import Permission
from app.core.schemas import ApiModel, Page
from app.modules.offers import service
from app.modules.offers.models import OfferStatus
from app.modules.offers.schemas import (
    OfferAction,
    OfferConvert,
    OfferCreate,
    OfferDetail,
    OfferLineCreate,
    OfferLineUpdate,
    OfferListItem,
    OfferPrint,
    OfferUpdate,
    PackageImport,
    Rate,
)
from app.modules.users.models import User

router = APIRouter(prefix="/offers", tags=["offers"])

Viewer = Annotated[User, Depends(require(Permission.OFFERS_VIEW))]
Manager = Annotated[User, Depends(require(Permission.OFFERS_MANAGE))]
EventManager = Annotated[User, Depends(require(Permission.EVENTS_MANAGE))]


class PackageImportRequest(PackageImport):
    # Paket maliyetlerinde teklif dışı yabancı para varsa TL kurları
    cost_rates: dict[Currency, Rate] = Field(default_factory=dict)


class ConvertResult(ApiModel):
    event_id: int
    event_no: str


@router.get("", response_model=Page[OfferListItem])
def list_offers(
    db: DbSession,
    _: Viewer,
    search: Annotated[str | None, Query(max_length=100)] = None,
    status: OfferStatus | None = None,
    customer_id: int | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> Page[OfferListItem]:
    items, total = service.list_offers(
        db, search=search, status=status, customer_id=customer_id, offset=offset, limit=limit
    )
    return Page(items=items, total=total)


@router.post("", response_model=OfferDetail, status_code=status.HTTP_201_CREATED)
def create_offer(data: OfferCreate, db: DbSession, actor: Manager, context: Context) -> OfferDetail:
    offer = service.create_offer(db, data, actor=actor, context=context)
    return service.offer_detail(db, offer, actor)


@router.get("/{offer_id}", response_model=OfferDetail)
def get_offer(offer_id: int, db: DbSession, user: Viewer) -> OfferDetail:
    return service.offer_detail(db, service.get_offer(db, offer_id), user)


@router.patch("/{offer_id}", response_model=OfferDetail)
def update_offer(
    offer_id: int, data: OfferUpdate, db: DbSession, actor: Manager, context: Context
) -> OfferDetail:
    offer = service.update_offer(
        db, service.get_offer(db, offer_id), data, actor=actor, context=context
    )
    return service.offer_detail(db, offer, actor)


@router.post("/{offer_id}/status", response_model=OfferDetail)
def change_status(
    offer_id: int, data: OfferAction, db: DbSession, actor: Manager, context: Context
) -> OfferDetail:
    offer = service.change_status(
        db, service.get_offer(db, offer_id), data.action, data.note, actor=actor, context=context
    )
    return service.offer_detail(db, offer, actor)


@router.post("/{offer_id}/duplicate", response_model=OfferDetail, status_code=201)
def duplicate_offer(offer_id: int, db: DbSession, actor: Manager, context: Context) -> OfferDetail:
    offer = service.duplicate_offer(
        db, service.get_offer(db, offer_id), actor=actor, context=context
    )
    return service.offer_detail(db, offer, actor)


@router.post("/{offer_id}/convert", response_model=ConvertResult, status_code=201)
def convert_offer(
    offer_id: int,
    data: OfferConvert,
    db: DbSession,
    actor: Manager,
    _: EventManager,
    context: Context,
) -> ConvertResult:
    event = service.convert_to_event(
        db, service.get_offer(db, offer_id), data.note, actor=actor, context=context
    )
    return ConvertResult(event_id=event.id, event_no=event.event_no)


@router.get("/{offer_id}/print", response_model=OfferPrint)
def print_offer(offer_id: int, db: DbSession, _: Viewer) -> OfferPrint:
    return service.offer_print(db, service.get_offer(db, offer_id))


@router.post("/{offer_id}/lines", response_model=OfferDetail, status_code=201)
def add_line(
    offer_id: int, data: OfferLineCreate, db: DbSession, actor: Manager, context: Context
) -> OfferDetail:
    offer = service.add_line(
        db, service.get_offer(db, offer_id), data, actor=actor, context=context
    )
    return service.offer_detail(db, offer, actor)


@router.post("/{offer_id}/packages", response_model=OfferDetail, status_code=201)
def import_package(
    offer_id: int, data: PackageImportRequest, db: DbSession, actor: Manager, context: Context
) -> OfferDetail:
    offer = service.import_package(
        db,
        service.get_offer(db, offer_id),
        PackageImport(package_id=data.package_id, price=data.price),
        dict(data.cost_rates),
        actor=actor,
        context=context,
    )
    return service.offer_detail(db, offer, actor)


@router.patch("/{offer_id}/lines/{line_id}", response_model=OfferDetail)
def update_line(
    offer_id: int,
    line_id: int,
    data: OfferLineUpdate,
    db: DbSession,
    actor: Manager,
    context: Context,
) -> OfferDetail:
    offer = service.get_offer(db, offer_id)
    line = service.get_line(offer, line_id)
    offer = service.update_line(db, offer, line, data, actor=actor, context=context)
    return service.offer_detail(db, offer, actor)


@router.delete("/{offer_id}/lines/{line_id}", response_model=OfferDetail)
def delete_line(
    offer_id: int, line_id: int, db: DbSession, actor: Manager, context: Context
) -> OfferDetail:
    offer = service.get_offer(db, offer_id)
    line = service.get_line(offer, line_id)
    offer = service.delete_line(db, offer, line, actor=actor, context=context)
    return service.offer_detail(db, offer, actor)
