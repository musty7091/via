from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.service_catalog.schemas.service import (
    ServiceItemCreate,
    ServiceItemRead,
    ServiceItemUpdate,
)
from app.modules.service_catalog.services import service_service

router = APIRouter(prefix="/service-catalog/services", tags=["Service Catalog - Technical Services"])


@router.get("", response_model=list[ServiceItemRead])
def list_service_items(
    search: str | None = Query(default=None),
    service_type: str | None = Query(default=None),
    is_active: bool | None = Query(default=True),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return service_service.list_service_items(
        db=db,
        search=search,
        service_type=service_type,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=ServiceItemRead, status_code=status.HTTP_201_CREATED)
def create_service_item(
    payload: ServiceItemCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return service_service.create_service_item(db=db, payload=payload)


@router.get("/{service_item_id}", response_model=ServiceItemRead)
def get_service_item(
    service_item_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return service_service.get_service_item_or_404(db=db, service_item_id=service_item_id)


@router.put("/{service_item_id}", response_model=ServiceItemRead)
def update_service_item(
    service_item_id: int,
    payload: ServiceItemUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return service_service.update_service_item(
        db=db,
        service_item_id=service_item_id,
        payload=payload,
    )
