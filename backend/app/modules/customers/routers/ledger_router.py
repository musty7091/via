from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.customers.schemas.ledger import (
    CustomerLedgerMovementCreate,
    CustomerLedgerMovementRead,
    CustomerLedgerSummary,
)
from app.modules.customers.services import ledger_service

router = APIRouter(prefix="/customers/{customer_id}/ledger", tags=["Customer Ledger"])


@router.get("/summary", response_model=CustomerLedgerSummary)
def get_ledger_summary(
    customer_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return ledger_service.get_ledger_summary(db=db, customer_id=customer_id)


@router.get("", response_model=list[CustomerLedgerMovementRead])
def list_ledger(
    customer_id: int,
    include_cancelled: bool = Query(default=False),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return ledger_service.list_ledger(
        db=db,
        customer_id=customer_id,
        include_cancelled=include_cancelled,
    )


@router.post("", response_model=CustomerLedgerMovementRead, status_code=status.HTTP_201_CREATED)
def create_ledger_movement(
    customer_id: int,
    payload: CustomerLedgerMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ledger_service.create_movement(
        db=db,
        customer_id=customer_id,
        payload=payload,
        created_by_user_id=current_user.id,
    )
