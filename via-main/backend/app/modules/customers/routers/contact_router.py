from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.customers.schemas.contact import CustomerContactCreate, CustomerContactRead
from app.modules.customers.services import contact_service

router = APIRouter(prefix="/customers/{customer_id}/contacts", tags=["Customer Contacts"])


@router.get("", response_model=list[CustomerContactRead])
def list_contacts(
    customer_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return contact_service.list_contacts(db=db, customer_id=customer_id)


@router.post("", response_model=CustomerContactRead, status_code=status.HTTP_201_CREATED)
def create_contact(
    customer_id: int,
    payload: CustomerContactCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return contact_service.create_contact(
        db=db,
        customer_id=customer_id,
        payload=payload,
    )