from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.supplier_payables.schemas import (
    EventSupplierPayablesDetail,
    SupplierPayableCreate,
    SupplierPayableRead,
    SupplierPaymentCancel,
    SupplierPaymentCreate,
    SupplierPaymentRead,
)
from app.modules.supplier_payables.services import (
    cancel_supplier_payment,
    create_supplier_payable,
    create_supplier_payment,
    get_event_supplier_payables_detail,
)

router = APIRouter(prefix="/events/{event_id}/supplier-payables", tags=["Supplier Payables"])


@router.get("", response_model=EventSupplierPayablesDetail)
def get_supplier_payables_detail(
    event_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return get_event_supplier_payables_detail(
        db=db,
        event_id=event_id,
    )


@router.post("", response_model=SupplierPayableRead, status_code=status.HTTP_201_CREATED)
def create_payable(
    event_id: int,
    payload: SupplierPayableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_supplier_payable(
        db=db,
        event_id=event_id,
        payload=payload,
        current_user=current_user,
    )


@router.post("/{payable_id}/payments", response_model=SupplierPaymentRead, status_code=status.HTTP_201_CREATED)
def create_payment(
    event_id: int,
    payable_id: int,
    payload: SupplierPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_supplier_payment(
        db=db,
        event_id=event_id,
        payable_id=payable_id,
        payload=payload,
        current_user=current_user,
    )


@router.post("/{payable_id}/payments/{payment_id}/cancel", response_model=SupplierPaymentRead)
def cancel_payment(
    event_id: int,
    payable_id: int,
    payment_id: int,
    payload: SupplierPaymentCancel,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return cancel_supplier_payment(
        db=db,
        event_id=event_id,
        payable_id=payable_id,
        payment_id=payment_id,
        payload=payload,
        current_user=current_user,
    )
