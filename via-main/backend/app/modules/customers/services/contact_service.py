from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.customers import constants
from app.modules.customers.repositories import contact_repository
from app.modules.customers.schemas.contact import CustomerContactCreate
from app.modules.customers.services.customer_service import get_customer_or_404


def _validate_contact_role(value: str | None) -> None:
    if value is None:
        return

    if value not in constants.CONTACT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"contact_role gecersiz. Gecerli degerler: {', '.join(constants.CONTACT_ROLES)}",
        )


def list_contacts(db: Session, customer_id: int):
    get_customer_or_404(db=db, customer_id=customer_id)
    return contact_repository.list_contacts(db=db, customer_id=customer_id)


def create_contact(db: Session, customer_id: int, payload: CustomerContactCreate):
    get_customer_or_404(db=db, customer_id=customer_id)
    _validate_contact_role(payload.contact_role)

    return contact_repository.create_contact(
        db=db,
        customer_id=customer_id,
        data=payload.model_dump(),
    )