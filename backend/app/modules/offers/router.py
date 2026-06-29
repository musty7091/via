from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.offers.schemas import (
    ConvertAgreementRequest,
    ImportPackageRequest,
    OfferCreate,
    OfferDetail,
    OfferInternalItemRead,
    OfferItemCreate,
    OfferItemUpdate,
    OfferPrintView,
    OfferRead,
    OfferUpdate,
)
from app.modules.offers.services import offer_service

router = APIRouter(prefix="/offers", tags=["Offers / Agreements"])


@router.get("", response_model=list[OfferRead])
def list_offers(
    search: str | None = Query(default=None),
    customer_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return offer_service.list_offers(
        db=db,
        search=search,
        customer_id=customer_id,
        status=status,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=OfferRead, status_code=status.HTTP_201_CREATED)
def create_offer(
    payload: OfferCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return offer_service.create_offer(db=db, payload=payload)


@router.get("/{offer_id}/detail", response_model=OfferDetail)
def get_offer_detail(
    offer_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return offer_service.get_offer_detail(db=db, offer_id=offer_id)


@router.put("/{offer_id}", response_model=OfferRead)
def update_offer(
    offer_id: int,
    payload: OfferUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return offer_service.update_offer(db=db, offer_id=offer_id, payload=payload)


@router.post("/{offer_id}/items", response_model=OfferInternalItemRead, status_code=status.HTTP_201_CREATED)
def create_offer_item(
    offer_id: int,
    payload: OfferItemCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return offer_service.create_offer_item(db=db, offer_id=offer_id, payload=payload)


@router.patch("/{offer_id}/items/{item_id}", response_model=OfferInternalItemRead)
def update_offer_item(
    offer_id: int,
    item_id: int,
    payload: OfferItemUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return offer_service.update_offer_item(
        db=db,
        offer_id=offer_id,
        item_id=item_id,
        payload=payload,
    )


@router.delete("/{offer_id}/items/{item_id}", response_model=OfferInternalItemRead)
def deactivate_offer_item(
    offer_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return offer_service.deactivate_offer_item(db=db, offer_id=offer_id, item_id=item_id)


@router.post("/{offer_id}/import-package", response_model=OfferDetail)
def import_package_to_offer(
    offer_id: int,
    payload: ImportPackageRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return offer_service.import_package_to_offer(db=db, offer_id=offer_id, payload=payload)


@router.post("/{offer_id}/cancel", response_model=OfferRead)
def cancel_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return offer_service.cancel_offer(db=db, offer_id=offer_id)


@router.post("/{offer_id}/convert-to-agreement", response_model=OfferRead)
def convert_to_agreement(
    offer_id: int,
    payload: ConvertAgreementRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return offer_service.convert_to_agreement(db=db, offer_id=offer_id, payload=payload)


@router.get("/{offer_id}/print-view", response_model=OfferPrintView)
def get_print_view(
    offer_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return offer_service.get_print_view(db=db, offer_id=offer_id)
