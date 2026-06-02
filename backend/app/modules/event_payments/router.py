from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.event_payments.schemas import (
    CollectionCancel,
    CollectionCreate,
    CollectionRead,
    EventPaymentsDetail,
    PaymentPlanCreate,
    PaymentPlanRead,
    PaymentPlanUpdate,
)
from app.modules.event_payments.services import event_payment_service

router = APIRouter(prefix="/events/{event_id}/payments", tags=["Event Payments"])


@router.get("", response_model=EventPaymentsDetail)
def get_event_payments_detail(
    event_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return event_payment_service.get_event_payments_detail(
        db=db,
        event_id=event_id,
    )


@router.post("/plans", response_model=PaymentPlanRead, status_code=status.HTTP_201_CREATED)
def create_payment_plan(
    event_id: int,
    payload: PaymentPlanCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return event_payment_service.create_payment_plan(
        db=db,
        event_id=event_id,
        payload=payload,
    )


@router.put("/plans/{payment_plan_id}", response_model=PaymentPlanRead)
def update_payment_plan(
    event_id: int,
    payment_plan_id: int,
    payload: PaymentPlanUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return event_payment_service.update_payment_plan(
        db=db,
        event_id=event_id,
        payment_plan_id=payment_plan_id,
        payload=payload,
    )


@router.post("/collections", response_model=CollectionRead, status_code=status.HTTP_201_CREATED)
def create_collection(
    event_id: int,
    payload: CollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return event_payment_service.create_collection(
        db=db,
        event_id=event_id,
        payload=payload,
        current_user=current_user,
    )


@router.post("/collections/{collection_id}/cancel", response_model=CollectionRead)
def cancel_collection(
    event_id: int,
    collection_id: int,
    payload: CollectionCancel,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return event_payment_service.cancel_collection(
        db=db,
        event_id=event_id,
        collection_id=collection_id,
        payload=payload,
    )
