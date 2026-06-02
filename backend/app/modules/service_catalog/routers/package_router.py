from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.service_catalog.schemas.package import (
    ServicePackageCreate,
    ServicePackageDetail,
    ServicePackageItemCreate,
    ServicePackageItemRead,
    ServicePackageRead,
    ServicePackageUpdate,
)
from app.modules.service_catalog.services import package_service

router = APIRouter(prefix="/service-catalog/packages", tags=["Service Catalog - Packages"])


@router.get("", response_model=list[ServicePackageRead])
def list_packages(
    search: str | None = Query(default=None),
    package_type: str | None = Query(default=None),
    is_active: bool | None = Query(default=True),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return package_service.list_packages(
        db=db,
        search=search,
        package_type=package_type,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=ServicePackageRead, status_code=status.HTTP_201_CREATED)
def create_package(
    payload: ServicePackageCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return package_service.create_package(db=db, payload=payload)


@router.get("/{package_id}/detail", response_model=ServicePackageDetail)
def get_package_detail(
    package_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return package_service.get_package_detail(db=db, package_id=package_id)


@router.put("/{package_id}", response_model=ServicePackageRead)
def update_package(
    package_id: int,
    payload: ServicePackageUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return package_service.update_package(db=db, package_id=package_id, payload=payload)


@router.get("/{package_id}/items", response_model=list[ServicePackageItemRead])
def list_package_items(
    package_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return package_service.list_package_items(db=db, package_id=package_id)


@router.post("/{package_id}/items", response_model=ServicePackageItemRead, status_code=status.HTTP_201_CREATED)
def create_package_item(
    package_id: int,
    payload: ServicePackageItemCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return package_service.create_package_item(db=db, package_id=package_id, payload=payload)
