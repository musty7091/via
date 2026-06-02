from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.customer import Customer


def get_customer(db: Session, customer_id: int) -> Customer | None:
    return db.get(Customer, customer_id)


def list_customers(
    db: Session,
    search: str | None = None,
    is_active: bool | None = None,
    customer_status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Customer]:
    query = db.query(Customer)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Customer.name.ilike(term),
                Customer.short_name.ilike(term),
                Customer.tax_number.ilike(term),
                Customer.phone.ilike(term),
                Customer.email.ilike(term),
            )
        )

    if is_active is not None:
        query = query.filter(Customer.is_active == is_active)

    if customer_status:
        query = query.filter(Customer.customer_status == customer_status)

    return query.order_by(Customer.name.asc()).offset(skip).limit(limit).all()


def create_customer(db: Session, data: dict) -> Customer:
    customer = Customer(**data)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def update_customer(db: Session, customer: Customer, data: dict) -> Customer:
    for key, value in data.items():
        setattr(customer, key, value)

    db.commit()
    db.refresh(customer)
    return customer