from sqlalchemy.orm import Session

from app.models.customer_contact import CustomerContact


def list_contacts(db: Session, customer_id: int) -> list[CustomerContact]:
    return (
        db.query(CustomerContact)
        .filter(CustomerContact.customer_id == customer_id)
        .order_by(CustomerContact.is_primary_contact.desc(), CustomerContact.full_name.asc())
        .all()
    )


def create_contact(db: Session, customer_id: int, data: dict) -> CustomerContact:
    if data.get("is_primary_contact"):
        (
            db.query(CustomerContact)
            .filter(CustomerContact.customer_id == customer_id)
            .update({CustomerContact.is_primary_contact: False})
        )

    contact = CustomerContact(customer_id=customer_id, **data)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact