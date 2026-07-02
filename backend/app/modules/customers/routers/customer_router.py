from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.customers.schemas.customer import (
    CustomerCreate,
    CustomerListItem,
    CustomerRead,
    CustomerUpdate,
)
from app.modules.customers.services import customer_service

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=list[CustomerListItem])
def list_customers(
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=True),
    customer_status: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return customer_service.list_customers(
        db=db,
        search=search,
        is_active=is_active,
        customer_status=customer_status,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return customer_service.create_customer(db=db, payload=payload)


@router.get("/{customer_id}", response_model=CustomerRead)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return customer_service.get_customer_or_404(db=db, customer_id=customer_id)


@router.put("/{customer_id}", response_model=CustomerRead)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return customer_service.update_customer(
        db=db,
        customer_id=customer_id,
        payload=payload,
    )


@router.patch("/{customer_id}/deactivate", response_model=CustomerRead)
def deactivate_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return customer_service.deactivate_customer(db=db, customer_id=customer_id)
