from collections import defaultdict
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import RequestContext
from app.core.errors import DomainError, NotFoundError
from app.core.money import ZERO, Currency, money
from app.core.permissions import Permission, permissions_for
from app.core.schemas import MoneyValue, columns
from app.core.text import fold, search_pattern
from app.core.updates import update_values
from app.db.base import Base
from app.modules.audit import service as audit
from app.modules.catalog.models import (
    Artist,
    ArtistRiderItem,
    ComponentType,
    Package,
    PackageItem,
    ServiceItem,
    Supplier,
)
from app.modules.catalog.schemas import (
    ArtistCreate,
    ArtistDetail,
    ArtistRead,
    ArtistUpdate,
    PackageCreate,
    PackageDetail,
    PackageItemCreate,
    PackageItemRead,
    PackageItemUpdate,
    PackageListItem,
    PackageSummary,
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
from app.modules.partners.models import Partner
from app.modules.users.models import User


def can_see_costs(user: User) -> bool:
    return Permission.COSTS_VIEW in permissions_for(user.role)


# --- Ortak yardımcılar ---

_SEARCH_FIELDS: dict[type[Base], tuple[str, ...]] = {
    Supplier: ("name", "contact_name", "phone", "tax_number"),
    Artist: ("name", "contact_name", "phone"),
    ServiceItem: ("name",),
    Package: ("name", "description"),
}

_LABELS: dict[type[Base], tuple[str, str]] = {
    # model: (entity_type, Türkçe ad)
    Supplier: ("supplier", "tedarikçisi"),
    Artist: ("artist", "sanatçısı"),
    ServiceItem: ("service", "hizmeti"),
    Package: ("package", "paketi"),
}


def _refresh_search(obj: Any) -> None:
    obj.search_text = fold(*(getattr(obj, f) for f in _SEARCH_FIELDS[type(obj)]))


def _get[M: Base](db: Session, model: type[M], obj_id: int, message: str) -> M:
    obj = db.get(model, obj_id)
    if obj is None:
        raise NotFoundError(message)
    return obj


def _list[M: Base](
    db: Session,
    model: type[M],
    *,
    search: str | None,
    is_active: bool | None,
    offset: int,
    limit: int,
    filters: list[Any] | None = None,
) -> tuple[list[M], int]:
    query = select(model)
    if search:
        query = query.where(model.search_text.like(search_pattern(search)))  # type: ignore[attr-defined]
    if is_active is not None:
        query = query.where(model.is_active == is_active)  # type: ignore[attr-defined]
    for condition in filters or []:
        query = query.where(condition)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.order_by(model.name).offset(offset).limit(limit)).all()  # type: ignore[attr-defined]
    return list(rows), total


def _create(
    db: Session, obj: Any, *, actor: User, context: RequestContext, fields: list[str]
) -> Any:
    _refresh_search(obj)
    db.add(obj)
    db.flush()
    entity_type, label = _LABELS[type(obj)]
    audit.record(
        db,
        actor=actor,
        action=f"{entity_type}.create",
        entity_type=entity_type,
        entity_id=obj.id,
        summary=f"{obj.name} {label} oluşturuldu.",
        changes=audit.snapshot(obj, fields),
        context=context,
    )
    db.commit()
    db.refresh(obj)
    return obj


def _update(
    db: Session,
    obj: Any,
    changes: dict[str, Any],
    *,
    actor: User,
    context: RequestContext,
    fields: list[str],
) -> Any:
    if not changes:
        return obj
    diff = audit.apply_changes(obj, changes, fields)
    _refresh_search(obj)
    entity_type, label = _LABELS[type(obj)]
    audit.record(
        db,
        actor=actor,
        action=f"{entity_type}.update",
        entity_type=entity_type,
        entity_id=obj.id,
        summary=f"{obj.name} {label} güncellendi.",
        changes=diff,
        context=context,
    )
    db.commit()
    db.refresh(obj)
    return obj


# --- Tedarikçi ---

SUPPLIER_FIELDS = list(SupplierUpdate.model_fields)


def supplier_read(supplier: Supplier) -> SupplierRead:
    return SupplierRead.model_validate(supplier)


def get_supplier(db: Session, supplier_id: int) -> Supplier:
    return _get(db, Supplier, supplier_id, "Tedarikçi bulunamadı.")


def list_suppliers(db: Session, **kwargs: Any) -> tuple[list[Supplier], int]:
    return _list(db, Supplier, **kwargs)


def create_supplier(db: Session, data: SupplierCreate, **kw: Any) -> Supplier:
    return _create(db, Supplier(**data.model_dump()), fields=SUPPLIER_FIELDS, **kw)


def update_supplier(db: Session, supplier: Supplier, data: SupplierUpdate, **kw: Any) -> Supplier:
    changes = update_values(data, {"name", "is_active"})
    return _update(db, supplier, changes, fields=SUPPLIER_FIELDS, **kw)


# --- Sanatçı ---

ARTIST_FIELDS = list(ArtistUpdate.model_fields)
ARTIST_REQUIRED = {"artist_type", "name", "cost_currency", "price_currency", "is_active"}
RIDER_FIELDS = list(RiderItemUpdate.model_fields)


def artist_read(artist: Artist, user: User) -> ArtistRead:
    data = columns(artist)
    data["manager_partner_name"] = (
        artist.manager_partner.full_name if artist.manager_partner else None
    )
    if not can_see_costs(user):
        data["default_cost"] = data["cost_currency"] = None
    return ArtistRead.model_validate(data)


def artist_detail(artist: Artist, user: User) -> ArtistDetail:
    return ArtistDetail(
        **artist_read(artist, user).model_dump(),
        rider_items=[RiderItemRead.model_validate(item) for item in artist.rider_items],
    )


def get_artist(db: Session, artist_id: int) -> Artist:
    return _get(db, Artist, artist_id, "Sanatçı bulunamadı.")


def _ensure_partner(db: Session, partner_id: int | None) -> None:
    if partner_id is not None and db.get(Partner, partner_id) is None:
        raise DomainError("Seçilen ortak bulunamadı.")


def list_artists(db: Session, *, artist_type: str | None = None, **kwargs: Any):
    filters = [Artist.artist_type == artist_type] if artist_type else []
    return _list(db, Artist, filters=filters, **kwargs)


def create_artist(db: Session, data: ArtistCreate, **kw: Any) -> Artist:
    _ensure_partner(db, data.manager_partner_id)
    return _create(db, Artist(**data.model_dump()), fields=ARTIST_FIELDS, **kw)


def update_artist(db: Session, artist: Artist, data: ArtistUpdate, **kw: Any) -> Artist:
    changes = update_values(data, ARTIST_REQUIRED)
    if "manager_partner_id" in changes:
        _ensure_partner(db, changes["manager_partner_id"])
    return _update(db, artist, changes, fields=ARTIST_FIELDS, **kw)


def get_rider_item(db: Session, artist: Artist, item_id: int) -> ArtistRiderItem:
    item = db.get(ArtistRiderItem, item_id)
    if item is None or item.artist_id != artist.id:
        raise NotFoundError("Rider maddesi bulunamadı.")
    return item


def create_rider_item(
    db: Session, artist: Artist, data: RiderItemCreate, *, actor: User, context: RequestContext
) -> ArtistRiderItem:
    item = ArtistRiderItem(artist_id=artist.id, **data.model_dump())
    db.add(item)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="artist.rider_create",
        entity_type="artist",
        entity_id=artist.id,
        summary=f"{artist.name} rider şartı eklendi: {item.title}.",
        changes=audit.snapshot(item, RIDER_FIELDS),
        context=context,
    )
    db.commit()
    db.refresh(artist)
    return item


def update_rider_item(
    db: Session,
    artist: Artist,
    item: ArtistRiderItem,
    data: RiderItemUpdate,
    *,
    actor: User,
    context: RequestContext,
) -> ArtistRiderItem:
    changes = update_values(data, {"category", "title", "is_required", "sort_order", "is_active"})
    if not changes:
        return item
    diff = audit.apply_changes(item, changes, RIDER_FIELDS)
    audit.record(
        db,
        actor=actor,
        action="artist.rider_update",
        entity_type="artist",
        entity_id=artist.id,
        summary=f"{artist.name} rider şartı güncellendi: {item.title}.",
        changes=diff,
        context=context,
    )
    db.commit()
    db.refresh(artist)
    return item


# --- Hizmet ---

SERVICE_FIELDS = list(ServiceUpdate.model_fields)
SERVICE_REQUIRED = {"service_type", "name", "unit", "cost_currency", "price_currency", "is_active"}


def service_read(service: ServiceItem, user: User) -> ServiceRead:
    data = columns(service)
    data["supplier_name"] = service.supplier.name if service.supplier else None
    if not can_see_costs(user):
        data["default_cost"] = data["cost_currency"] = None
    return ServiceRead.model_validate(data)


def get_service(db: Session, service_id: int) -> ServiceItem:
    return _get(db, ServiceItem, service_id, "Hizmet bulunamadı.")


def _ensure_supplier(db: Session, supplier_id: int | None) -> None:
    if supplier_id is not None and db.get(Supplier, supplier_id) is None:
        raise DomainError("Seçilen tedarikçi bulunamadı.")


def list_services(db: Session, *, service_type: str | None = None, **kwargs: Any):
    filters = [ServiceItem.service_type == service_type] if service_type else []
    return _list(db, ServiceItem, filters=filters, **kwargs)


def create_service(db: Session, data: ServiceCreate, **kw: Any) -> ServiceItem:
    _ensure_supplier(db, data.supplier_id)
    return _create(db, ServiceItem(**data.model_dump()), fields=SERVICE_FIELDS, **kw)


def update_service(
    db: Session, service: ServiceItem, data: ServiceUpdate, **kw: Any
) -> ServiceItem:
    changes = update_values(data, SERVICE_REQUIRED)
    if "supplier_id" in changes:
        _ensure_supplier(db, changes["supplier_id"])
    return _update(db, service, changes, fields=SERVICE_FIELDS, **kw)


# --- Paket ---

PACKAGE_FIELDS = list(PackageUpdate.model_fields)
PACKAGE_REQUIRED = {"package_type", "name", "price", "currency", "is_active"}
PACKAGE_ITEM_FIELDS = [
    "component_type",
    "artist_id",
    "service_id",
    *PackageItemUpdate.model_fields,
]


def get_package(db: Session, package_id: int) -> Package:
    return _get(db, Package, package_id, "Paket bulunamadı.")


def list_packages(db: Session, *, package_type: str | None = None, **kwargs: Any):
    filters = [Package.package_type == package_type] if package_type else []
    packages, total = _list(db, Package, filters=filters, **kwargs)
    counts = dict(
        db.execute(
            select(PackageItem.package_id, func.count())
            .where(PackageItem.package_id.in_([p.id for p in packages]))
            .group_by(PackageItem.package_id)
        ).all()
    )
    items = [
        PackageListItem.model_validate({**columns(p), "item_count": counts.get(p.id, 0)})
        for p in packages
    ]
    return items, total


def _summary(package: Package) -> PackageSummary:
    costs: dict[Currency, Decimal] = defaultdict(lambda: ZERO)
    for item in package.items:
        costs[Currency(item.cost_currency)] += money(item.unit_cost * item.quantity)
    package_currency = Currency(package.currency)
    foreign = [c for c in costs if c != package_currency and costs[c] != 0]
    gross_profit = margin = None
    if not foreign:
        gross_profit = money(package.price - costs.get(package_currency, ZERO))
        if package.price > 0:
            margin = (gross_profit / package.price * 100).quantize(Decimal("0.1"))
    return PackageSummary(
        price=MoneyValue(amount=package.price, currency=package_currency),
        costs=[MoneyValue(amount=amount, currency=c) for c, amount in sorted(costs.items())],
        gross_profit=gross_profit,
        margin_percent=margin,
        needs_exchange_rate=bool(foreign),
    )


def package_detail(package: Package, user: User) -> PackageDetail:
    show_costs = can_see_costs(user)
    items = []
    for item in package.items:
        source = item.artist or item.service
        data = columns(item)
        data["total_cost"] = money(item.unit_cost * item.quantity)
        data["source_is_active"] = source.is_active if source else True
        if not show_costs:
            data["unit_cost"] = data["cost_currency"] = data["total_cost"] = None
        items.append(PackageItemRead.model_validate(data))
    data = columns(package)
    if not show_costs:
        data["internal_notes"] = None
    return PackageDetail.model_validate(
        {**data, "items": items, "summary": _summary(package) if show_costs else None}
    )


def create_package(db: Session, data: PackageCreate, **kw: Any) -> Package:
    return _create(db, Package(**data.model_dump()), fields=PACKAGE_FIELDS, **kw)


def update_package(db: Session, package: Package, data: PackageUpdate, **kw: Any) -> Package:
    changes = update_values(data, PACKAGE_REQUIRED)
    return _update(db, package, changes, fields=PACKAGE_FIELDS, **kw)


def get_package_item(db: Session, package: Package, item_id: int) -> PackageItem:
    item = db.get(PackageItem, item_id)
    if item is None or item.package_id != package.id:
        raise NotFoundError("Paket kalemi bulunamadı.")
    return item


def create_package_item(
    db: Session, package: Package, data: PackageItemCreate, *, actor: User, context: RequestContext
) -> PackageItem:
    values = data.model_dump()
    source: Artist | ServiceItem | None = None
    if data.component_type == ComponentType.ARTIST:
        source = get_artist(db, data.artist_id)  # type: ignore[arg-type]
    elif data.component_type == ComponentType.SERVICE:
        source = get_service(db, data.service_id)  # type: ignore[arg-type]

    if source is not None:
        if not source.is_active:
            raise DomainError(f"{source.name} pasif durumda; pakete eklenemez.")
        values["title"] = values["title"] or source.name
        if values["unit_cost"] is None:
            values["unit_cost"] = source.default_cost or ZERO
    if values["unit_cost"] is None:
        values["unit_cost"] = ZERO
    if values["cost_currency"] is None:
        values["cost_currency"] = source.cost_currency if source else Currency.TRY
    if values["sort_order"] is None:
        values["sort_order"] = (
            db.scalar(
                select(func.coalesce(func.max(PackageItem.sort_order), 0)).where(
                    PackageItem.package_id == package.id
                )
            )
            + 10
        )

    item = PackageItem(package_id=package.id, **values)
    db.add(item)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="package.item_create",
        entity_type="package",
        entity_id=package.id,
        summary=f"{package.name} paketine eklendi: {item.title}.",
        changes=audit.snapshot(item, PACKAGE_ITEM_FIELDS),
        context=context,
    )
    db.commit()
    db.refresh(package)
    return item


def update_package_item(
    db: Session,
    package: Package,
    item: PackageItem,
    data: PackageItemUpdate,
    *,
    actor: User,
    context: RequestContext,
) -> PackageItem:
    changes = update_values(
        data,
        {
            "title",
            "program_section",
            "quantity",
            "unit_cost",
            "cost_currency",
            "is_visible_on_offer",
            "sort_order",
        },
    )
    if not changes:
        return item
    diff = audit.apply_changes(item, changes, PACKAGE_ITEM_FIELDS)
    if (item.start_time is None) != (item.end_time is None):
        raise DomainError("Başlangıç ve bitiş saati birlikte girilmelidir.")
    audit.record(
        db,
        actor=actor,
        action="package.item_update",
        entity_type="package",
        entity_id=package.id,
        summary=f"{package.name} paket kalemi güncellendi: {item.title}.",
        changes=diff,
        context=context,
    )
    db.commit()
    db.refresh(package)
    return item


def delete_package_item(
    db: Session, package: Package, item: PackageItem, *, actor: User, context: RequestContext
) -> None:
    """Paket bir şablondur; teklifler kalemleri kopyalayarak kullanır. Bu yüzden kalem
    silmek geçmiş teklifleri etkilemez."""
    audit.record(
        db,
        actor=actor,
        action="package.item_delete",
        entity_type="package",
        entity_id=package.id,
        summary=f"{package.name} paketinden çıkarıldı: {item.title}.",
        changes=audit.snapshot(item, PACKAGE_ITEM_FIELDS),
        context=context,
    )
    db.delete(item)
    db.commit()
    db.refresh(package)
