from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.service_package import ServicePackage, ServicePackageItem


def get_package(db: Session, package_id: int) -> ServicePackage | None:
    return db.get(ServicePackage, package_id)


def list_packages(
    db: Session,
    search: str | None = None,
    package_type: str | None = None,
    is_active: bool | None = True,
    skip: int = 0,
    limit: int = 100,
) -> list[ServicePackage]:
    query = db.query(ServicePackage)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                ServicePackage.name.ilike(term),
                ServicePackage.description.ilike(term),
                ServicePackage.notes.ilike(term),
            )
        )

    if package_type:
        query = query.filter(ServicePackage.package_type == package_type)

    if is_active is not None:
        query = query.filter(ServicePackage.is_active == is_active)

    return query.order_by(ServicePackage.name.asc()).offset(skip).limit(limit).all()


def create_package(db: Session, data: dict) -> ServicePackage:
    package = ServicePackage(**data)
    db.add(package)
    db.commit()
    db.refresh(package)
    return package


def update_package(db: Session, package: ServicePackage, data: dict) -> ServicePackage:
    for key, value in data.items():
        setattr(package, key, value)

    db.commit()
    db.refresh(package)
    return package


def list_package_items(db: Session, package_id: int) -> list[ServicePackageItem]:
    return (
        db.query(ServicePackageItem)
        .filter(ServicePackageItem.package_id == package_id)
        .order_by(ServicePackageItem.sort_order.asc(), ServicePackageItem.id.asc())
        .all()
    )


def create_package_item(db: Session, data: dict) -> ServicePackageItem:
    item = ServicePackageItem(**data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
