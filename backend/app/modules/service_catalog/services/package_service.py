from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.artist import Artist, ServiceItem
from app.models.service_package import ServicePackage
from app.modules.service_catalog import constants
from app.modules.service_catalog.repositories import package_repository
from app.modules.service_catalog.schemas.package import (
    ServicePackageCreate,
    ServicePackageDetail,
    ServicePackageItemCreate,
    ServicePackageItemRead,
    ServicePackageRead,
    ServicePackageSummary,
    ServicePackageUpdate,
)


def _validate_choice(field_name: str, value: str | None, allowed_values: list[str]) -> None:
    if value is None:
        return

    if value not in allowed_values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} geçersiz. Geçerli değerler: {', '.join(allowed_values)}",
        )


def get_package_or_404(db: Session, package_id: int) -> ServicePackage:
    package = package_repository.get_package(db=db, package_id=package_id)

    if package is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hizmet paketi bulunamadı.",
        )

    return package


def list_packages(
    db: Session,
    search: str | None = None,
    package_type: str | None = None,
    is_active: bool | None = True,
    skip: int = 0,
    limit: int = 100,
):
    return package_repository.list_packages(
        db=db,
        search=search,
        package_type=package_type,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )


def create_package(db: Session, payload: ServicePackageCreate):
    _validate_choice("package_type", payload.package_type, constants.PACKAGE_TYPES)
    _validate_choice("default_sale_currency", payload.default_sale_currency, constants.CURRENCIES)

    return package_repository.create_package(db=db, data=payload.model_dump())


def update_package(db: Session, package_id: int, payload: ServicePackageUpdate):
    package = get_package_or_404(db=db, package_id=package_id)
    data = payload.model_dump(exclude_unset=True)

    _validate_choice("package_type", data.get("package_type"), constants.PACKAGE_TYPES)
    _validate_choice("default_sale_currency", data.get("default_sale_currency"), constants.CURRENCIES)

    return package_repository.update_package(db=db, package=package, data=data)


def _build_item_title(db: Session, payload: ServicePackageItemCreate) -> str:
    if payload.title:
        return payload.title

    if payload.component_type == "artist" and payload.artist_id:
        artist = db.get(Artist, payload.artist_id)
        if artist is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paket bileşeni için sanatçı hizmeti bulunamadı.",
            )
        return artist.name

    if payload.component_type == "service" and payload.service_item_id:
        service_item = db.get(ServiceItem, payload.service_item_id)
        if service_item is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paket bileşeni için teknik hizmet bulunamadı.",
            )
        return service_item.name

    if payload.component_type == "manual":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Manuel bileşen için başlık zorunludur.",
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Paket bileşeni sanatçı, hizmet veya manuel olmalıdır.",
    )


def _validate_package_item_payload(db: Session, payload: ServicePackageItemCreate) -> None:
    _validate_choice("component_type", payload.component_type, constants.PACKAGE_COMPONENT_TYPES)
    _validate_choice("program_section", payload.program_section, constants.PROGRAM_SECTIONS)
    _validate_choice("unit_cost_currency", payload.unit_cost_currency, constants.CURRENCIES)
    _validate_choice("unit_sale_currency", payload.unit_sale_currency, constants.CURRENCIES)

    if payload.component_type == "artist" and payload.artist_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sanatçı bileşeni için artist_id zorunludur.",
        )

    if payload.component_type == "service" and payload.service_item_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hizmet bileşeni için service_item_id zorunludur.",
        )

    if payload.artist_id and db.get(Artist, payload.artist_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sanatçı hizmeti bulunamadı.",
        )

    if payload.service_item_id and db.get(ServiceItem, payload.service_item_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teknik / operasyon hizmeti bulunamadı.",
        )


def _to_item_read(db: Session, item) -> ServicePackageItemRead:
    artist_name = None
    service_item_name = None

    if item.artist_id:
        artist = db.get(Artist, item.artist_id)
        artist_name = artist.name if artist else None

    if item.service_item_id:
        service_item = db.get(ServiceItem, item.service_item_id)
        service_item_name = service_item.name if service_item else None

    total_cost = float(item.total_cost_amount)
    total_sale = float(item.total_sale_amount)

    return ServicePackageItemRead(
        id=item.id,
        package_id=item.package_id,
        component_type=item.component_type,
        artist_id=item.artist_id,
        artist_name=artist_name,
        service_item_id=item.service_item_id,
        service_item_name=service_item_name,
        title=item.title,
        program_section=item.program_section,
        sort_order=item.sort_order,
        start_time=item.start_time,
        end_time=item.end_time,
        quantity=float(item.quantity),
        unit_cost_amount=float(item.unit_cost_amount),
        unit_cost_currency=item.unit_cost_currency,
        unit_sale_amount=float(item.unit_sale_amount),
        unit_sale_currency=item.unit_sale_currency,
        total_cost_amount=total_cost,
        total_sale_amount=total_sale,
        gross_profit_amount=round(total_sale - total_cost, 4),
        is_optional=item.is_optional,
        is_visible_on_offer=item.is_visible_on_offer,
        is_active=item.is_active,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _build_detail(db: Session, package: ServicePackage) -> ServicePackageDetail:
    items = package_repository.list_package_items(db=db, package_id=package.id)
    item_reads = [_to_item_read(db=db, item=item) for item in items if item.is_active]

    total_cost = round(sum(item.total_cost_amount for item in item_reads), 4)
    total_sale = round(sum(item.total_sale_amount for item in item_reads), 4)

    return ServicePackageDetail(
        package=ServicePackageRead.model_validate(package),
        items=item_reads,
        summary=ServicePackageSummary(
            package_id=package.id,
            item_count=len(item_reads),
            total_cost_amount=total_cost,
            total_sale_amount=total_sale,
            gross_profit_amount=round(total_sale - total_cost, 4),
        ),
    )


def get_package_detail(db: Session, package_id: int) -> ServicePackageDetail:
    package = get_package_or_404(db=db, package_id=package_id)
    return _build_detail(db=db, package=package)


def list_package_items(db: Session, package_id: int):
    package = get_package_or_404(db=db, package_id=package_id)
    return _build_detail(db=db, package=package).items


def create_package_item(db: Session, package_id: int, payload: ServicePackageItemCreate):
    package = get_package_or_404(db=db, package_id=package_id)
    _validate_package_item_payload(db=db, payload=payload)

    title = _build_item_title(db=db, payload=payload)
    quantity = float(payload.quantity)
    unit_cost = float(payload.unit_cost_amount)
    unit_sale = float(payload.unit_sale_amount)

    data = payload.model_dump()
    data["package_id"] = package.id
    data["title"] = title
    data["total_cost_amount"] = round(quantity * unit_cost, 4)
    data["total_sale_amount"] = round(quantity * unit_sale, 4)

    created = package_repository.create_package_item(db=db, data=data)
    return _to_item_read(db=db, item=created)
