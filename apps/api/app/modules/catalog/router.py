from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import Context, DbSession, require
from app.core.permissions import Permission
from app.core.schemas import Page
from app.modules.catalog import service
from app.modules.catalog.models import ArtistType, PackageType, ServiceType
from app.modules.catalog.schemas import (
    ArtistCreate,
    ArtistDetail,
    ArtistRead,
    ArtistUpdate,
    PackageCreate,
    PackageDetail,
    PackageItemCreate,
    PackageItemUpdate,
    PackageListItem,
    PackageUpdate,
    RiderItemCreate,
    RiderItemRead,
    RiderItemUpdate,
    ServiceCreate,
    ServiceRead,
    ServiceUpdate,
    SupplierCreate,
    SupplierRead,
    SupplierUpdate,
)
from app.modules.users.models import User

router = APIRouter(prefix="/catalog", tags=["catalog"])

Viewer = Annotated[User, Depends(require(Permission.CATALOG_VIEW))]
Manager = Annotated[User, Depends(require(Permission.CATALOG_MANAGE))]
CostViewer = Annotated[User, Depends(require(Permission.COSTS_VIEW))]
Search = Annotated[str | None, Query(max_length=100)]
Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=200)]


# --- Tedarikçiler (ödeme tarafı olduğu için sadece maliyet görenler listeler) ---


@router.get("/suppliers", response_model=Page[SupplierRead])
def list_suppliers(
    db: DbSession,
    _: CostViewer,
    search: Search = None,
    is_active: bool | None = True,
    offset: Offset = 0,
    limit: Limit = 25,
) -> Page[SupplierRead]:
    rows, total = service.list_suppliers(
        db, search=search, is_active=is_active, offset=offset, limit=limit
    )
    return Page(items=[service.supplier_read(r) for r in rows], total=total)


@router.get("/suppliers/{supplier_id}", response_model=SupplierRead)
def get_supplier(supplier_id: int, db: DbSession, _: CostViewer) -> SupplierRead:
    return service.supplier_read(service.get_supplier(db, supplier_id))


@router.post("/suppliers", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
def create_supplier(
    data: SupplierCreate, db: DbSession, actor: Manager, context: Context
) -> SupplierRead:
    return service.supplier_read(service.create_supplier(db, data, actor=actor, context=context))


@router.patch("/suppliers/{supplier_id}", response_model=SupplierRead)
def update_supplier(
    supplier_id: int, data: SupplierUpdate, db: DbSession, actor: Manager, context: Context
) -> SupplierRead:
    supplier = service.get_supplier(db, supplier_id)
    return service.supplier_read(
        service.update_supplier(db, supplier, data, actor=actor, context=context)
    )


# --- Sanatçılar ---


@router.get("/artists", response_model=Page[ArtistRead])
def list_artists(
    db: DbSession,
    user: Viewer,
    search: Search = None,
    artist_type: ArtistType | None = None,
    is_active: bool | None = True,
    offset: Offset = 0,
    limit: Limit = 25,
) -> Page[ArtistRead]:
    rows, total = service.list_artists(
        db,
        artist_type=artist_type,
        search=search,
        is_active=is_active,
        offset=offset,
        limit=limit,
    )
    return Page(items=[service.artist_read(r, user) for r in rows], total=total)


@router.post("/artists", response_model=ArtistDetail, status_code=status.HTTP_201_CREATED)
def create_artist(
    data: ArtistCreate, db: DbSession, actor: Manager, context: Context
) -> ArtistDetail:
    artist = service.create_artist(db, data, actor=actor, context=context)
    return service.artist_detail(artist, actor)


@router.get("/artists/{artist_id}", response_model=ArtistDetail)
def get_artist(artist_id: int, db: DbSession, user: Viewer) -> ArtistDetail:
    return service.artist_detail(service.get_artist(db, artist_id), user)


@router.patch("/artists/{artist_id}", response_model=ArtistDetail)
def update_artist(
    artist_id: int, data: ArtistUpdate, db: DbSession, actor: Manager, context: Context
) -> ArtistDetail:
    artist = service.update_artist(
        db, service.get_artist(db, artist_id), data, actor=actor, context=context
    )
    return service.artist_detail(artist, actor)


@router.post(
    "/artists/{artist_id}/rider-items",
    response_model=RiderItemRead,
    status_code=status.HTTP_201_CREATED,
)
def create_rider_item(
    artist_id: int, data: RiderItemCreate, db: DbSession, actor: Manager, context: Context
) -> RiderItemRead:
    artist = service.get_artist(db, artist_id)
    item = service.create_rider_item(db, artist, data, actor=actor, context=context)
    return RiderItemRead.model_validate(item)


@router.patch("/artists/{artist_id}/rider-items/{item_id}", response_model=RiderItemRead)
def update_rider_item(
    artist_id: int,
    item_id: int,
    data: RiderItemUpdate,
    db: DbSession,
    actor: Manager,
    context: Context,
) -> RiderItemRead:
    artist = service.get_artist(db, artist_id)
    item = service.get_rider_item(db, artist, item_id)
    item = service.update_rider_item(db, artist, item, data, actor=actor, context=context)
    return RiderItemRead.model_validate(item)


# --- Hizmetler ---


@router.get("/services", response_model=Page[ServiceRead])
def list_services(
    db: DbSession,
    user: Viewer,
    search: Search = None,
    service_type: ServiceType | None = None,
    is_active: bool | None = True,
    offset: Offset = 0,
    limit: Limit = 25,
) -> Page[ServiceRead]:
    rows, total = service.list_services(
        db,
        service_type=service_type,
        search=search,
        is_active=is_active,
        offset=offset,
        limit=limit,
    )
    return Page(items=[service.service_read(r, user) for r in rows], total=total)


@router.post("/services", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(
    data: ServiceCreate, db: DbSession, actor: Manager, context: Context
) -> ServiceRead:
    return service.service_read(
        service.create_service(db, data, actor=actor, context=context), actor
    )


@router.get("/services/{service_id}", response_model=ServiceRead)
def get_service(service_id: int, db: DbSession, user: Viewer) -> ServiceRead:
    return service.service_read(service.get_service(db, service_id), user)


@router.patch("/services/{service_id}", response_model=ServiceRead)
def update_service(
    service_id: int, data: ServiceUpdate, db: DbSession, actor: Manager, context: Context
) -> ServiceRead:
    item = service.update_service(
        db, service.get_service(db, service_id), data, actor=actor, context=context
    )
    return service.service_read(item, actor)


# --- Paketler ---


@router.get("/packages", response_model=Page[PackageListItem])
def list_packages(
    db: DbSession,
    _: Viewer,
    search: Search = None,
    package_type: PackageType | None = None,
    is_active: bool | None = True,
    offset: Offset = 0,
    limit: Limit = 25,
) -> Page[PackageListItem]:
    items, total = service.list_packages(
        db,
        package_type=package_type,
        search=search,
        is_active=is_active,
        offset=offset,
        limit=limit,
    )
    return Page(items=items, total=total)


@router.post("/packages", response_model=PackageDetail, status_code=status.HTTP_201_CREATED)
def create_package(
    data: PackageCreate, db: DbSession, actor: Manager, context: Context
) -> PackageDetail:
    return service.package_detail(
        service.create_package(db, data, actor=actor, context=context), actor
    )


@router.get("/packages/{package_id}", response_model=PackageDetail)
def get_package(package_id: int, db: DbSession, user: Viewer) -> PackageDetail:
    return service.package_detail(service.get_package(db, package_id), user)


@router.patch("/packages/{package_id}", response_model=PackageDetail)
def update_package(
    package_id: int, data: PackageUpdate, db: DbSession, actor: Manager, context: Context
) -> PackageDetail:
    package = service.update_package(
        db, service.get_package(db, package_id), data, actor=actor, context=context
    )
    return service.package_detail(package, actor)


@router.post(
    "/packages/{package_id}/items",
    response_model=PackageDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_package_item(
    package_id: int, data: PackageItemCreate, db: DbSession, actor: Manager, context: Context
) -> PackageDetail:
    package = service.get_package(db, package_id)
    service.create_package_item(db, package, data, actor=actor, context=context)
    return service.package_detail(package, actor)


@router.patch("/packages/{package_id}/items/{item_id}", response_model=PackageDetail)
def update_package_item(
    package_id: int,
    item_id: int,
    data: PackageItemUpdate,
    db: DbSession,
    actor: Manager,
    context: Context,
) -> PackageDetail:
    package = service.get_package(db, package_id)
    item = service.get_package_item(db, package, item_id)
    service.update_package_item(db, package, item, data, actor=actor, context=context)
    return service.package_detail(package, actor)


@router.delete("/packages/{package_id}/items/{item_id}", response_model=PackageDetail)
def delete_package_item(
    package_id: int, item_id: int, db: DbSession, actor: Manager, context: Context
) -> PackageDetail:
    package = service.get_package(db, package_id)
    item = service.get_package_item(db, package, item_id)
    service.delete_package_item(db, package, item, actor=actor, context=context)
    return service.package_detail(package, actor)
