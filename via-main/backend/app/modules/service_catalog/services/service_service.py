from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.artist import ServiceItem
from app.modules.service_catalog import constants
from app.modules.service_catalog.repositories import service_repository
from app.modules.service_catalog.schemas.service import ServiceItemCreate, ServiceItemUpdate


def _validate_choice(field_name: str, value: str | None, allowed_values: list[str]) -> None:
    if value is None:
        return

    if value not in allowed_values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} geçersiz. Geçerli değerler: {', '.join(allowed_values)}",
        )


def get_service_item_or_404(db: Session, service_item_id: int) -> ServiceItem:
    service_item = service_repository.get_service_item(
        db=db,
        service_item_id=service_item_id,
    )

    if service_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teknik / operasyon hizmeti bulunamadı.",
        )

    return service_item


def list_service_items(
    db: Session,
    search: str | None = None,
    service_type: str | None = None,
    is_active: bool | None = True,
    skip: int = 0,
    limit: int = 100,
):
    return service_repository.list_service_items(
        db=db,
        search=search,
        service_type=service_type,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )


def create_service_item(db: Session, payload: ServiceItemCreate):
    _validate_choice("service_type", payload.service_type, constants.SERVICE_TYPES)
    _validate_choice("default_cost_currency", payload.default_cost_currency, constants.CURRENCIES)
    _validate_choice("default_sale_currency", payload.default_sale_currency, constants.CURRENCIES)

    return service_repository.create_service_item(db=db, data=payload.model_dump())


def update_service_item(db: Session, service_item_id: int, payload: ServiceItemUpdate):
    service_item = get_service_item_or_404(db=db, service_item_id=service_item_id)
    data = payload.model_dump(exclude_unset=True)

    _validate_choice("service_type", data.get("service_type"), constants.SERVICE_TYPES)
    _validate_choice("default_cost_currency", data.get("default_cost_currency"), constants.CURRENCIES)
    _validate_choice("default_sale_currency", data.get("default_sale_currency"), constants.CURRENCIES)

    return service_repository.update_service_item(
        db=db,
        service_item=service_item,
        data=data,
    )
