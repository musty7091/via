from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.modules.customers import constants
from app.modules.customers.repositories import customer_repository
from app.modules.customers.schemas.customer import CustomerCreate, CustomerUpdate


def _validate_choice(field_name: str, value: str | None, allowed_values: list[str]) -> None:
    if value is None:
        return

    if value not in allowed_values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} gecersiz. Gecerli degerler: {', '.join(allowed_values)}",
        )


def get_customer_or_404(db: Session, customer_id: int) -> Customer:
    customer = customer_repository.get_customer(db=db, customer_id=customer_id)

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Musteri bulunamadi.",
        )

    return customer


def list_customers(
    db: Session,
    search: str | None = None,
    is_active: bool | None = None,
    customer_status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Customer]:
    return customer_repository.list_customers(
        db=db,
        search=search,
        is_active=is_active,
        customer_status=customer_status,
        skip=skip,
        limit=limit,
    )


def create_customer(db: Session, payload: CustomerCreate) -> Customer:
    _validate_choice("customer_type", payload.customer_type, constants.CUSTOMER_TYPES)
    _validate_choice("customer_status", payload.customer_status, constants.CUSTOMER_STATUSES)
    _validate_choice("default_invoice_type", payload.default_invoice_type, constants.INVOICE_TYPES)
    _validate_choice("default_currency", payload.default_currency, constants.CURRENCIES)
    _validate_choice("risk_level", payload.risk_level, constants.RISK_LEVELS)

    return customer_repository.create_customer(
        db=db,
        data=payload.model_dump(),
    )


def update_customer(db: Session, customer_id: int, payload: CustomerUpdate) -> Customer:
    customer = get_customer_or_404(db=db, customer_id=customer_id)
    data = payload.model_dump(exclude_unset=True)

    _validate_choice("customer_type", data.get("customer_type"), constants.CUSTOMER_TYPES)
    _validate_choice("customer_status", data.get("customer_status"), constants.CUSTOMER_STATUSES)
    _validate_choice("default_invoice_type", data.get("default_invoice_type"), constants.INVOICE_TYPES)
    _validate_choice("default_currency", data.get("default_currency"), constants.CURRENCIES)
    _validate_choice("risk_level", data.get("risk_level"), constants.RISK_LEVELS)

    return customer_repository.update_customer(db=db, customer=customer, data=data)


def deactivate_customer(db: Session, customer_id: int) -> Customer:
    customer = get_customer_or_404(db=db, customer_id=customer_id)

    return customer_repository.update_customer(
        db=db,
        customer=customer,
        data={
            "is_active": False,
            "customer_status": "passive",
        },
    )