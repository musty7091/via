from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.main import app
from app.models.customer import Customer
from app.models.event import Event, EventItem
from app.models.offer import Offer, OfferItem
from app.models.service_package import ServicePackage, ServicePackageItem

client = TestClient(app)


def expect_status(response, expected_status: int, label: str):
    if response.status_code != expected_status:
        raise RuntimeError(
            f"{label} failed. Expected {expected_status}, got {response.status_code}. Body: {response.text}"
        )


def first_customer_id(db: Session) -> int:
    customer = db.query(Customer).order_by(Customer.id.asc()).first()

    if customer:
        return customer.id

    customer = Customer(
        name="Smoke Etkinlik Müşterisi",
        short_name="Smoke",
        customer_type="hotel",
        is_active=True,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer.id


def first_package_id(db: Session) -> int:
    package = db.query(ServicePackage).order_by(ServicePackage.id.asc()).first()

    if package:
        return package.id

    package = ServicePackage(
        package_type="program",
        name="Smoke Etkinlik Paketi",
        default_sale_amount=0,
        default_sale_currency="TRY",
        is_active=True,
    )
    db.add(package)
    db.commit()
    db.refresh(package)

    item = ServicePackageItem(
        package_id=package.id,
        component_type="manual",
        title="Smoke Ana Program",
        program_section="main_performance",
        sort_order=1,
        quantity=1,
        unit_cost_amount=1000,
        unit_cost_currency="TRY",
        unit_sale_amount=2500,
        unit_sale_currency="TRY",
        total_cost_amount=1000,
        total_sale_amount=2500,
        is_visible_on_offer=True,
        is_active=True,
    )
    db.add(item)
    db.commit()
    return package.id


def cleanup_records(offer_id: int | None, event_id: int | None) -> None:
    db = SessionLocal()

    try:
        if event_id is not None:
            db.query(EventItem).filter(EventItem.event_id == event_id).delete(synchronize_session=False)
            db.query(Event).filter(Event.id == event_id).delete(synchronize_session=False)

        if offer_id is not None:
            db.query(OfferItem).filter(OfferItem.offer_id == offer_id).delete(synchronize_session=False)
            db.query(Offer).filter(Offer.id == offer_id).delete(synchronize_session=False)

        db.commit()
    finally:
        db.close()


def main() -> None:
    offer_routes = [route.path for route in app.routes if "offers" in route.path]
    event_routes = [route.path for route in app.routes if "events" in route.path]
    if not offer_routes:
        raise RuntimeError("Offer routes are not registered.")
    if not event_routes:
        raise RuntimeError("Event routes are not registered.")

    login_response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "admin@viaevents.com",
            "password": "Via12345!",
        },
    )
    expect_status(login_response, 200, "login")
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        customer_id = first_customer_id(db)
        package_id = first_package_id(db)
    finally:
        db.close()

    offer_id = None
    event_id = None

    try:
        offer_response = client.post(
            "/api/v1/offers",
            headers=headers,
            json={
                "customer_id": customer_id,
                "package_id": package_id,
                "title": "Smoke Anlaşmadan Etkinlik",
                "event_date": "2026-07-15",
                "invoice_type": "with_invoice",
                "vat_rate": 16,
                "currency": "TRY",
                "advance_payment_amount": 1000,
                "advance_payment_currency": "TRY",
                "payment_terms": "Kapora peşin, kalan etkinlik öncesi.",
                "customer_visible_notes": "Müşteriye görünecek not.",
                "internal_notes": "Müşteriye görünmez.",
            },
        )
        expect_status(offer_response, 201, "create offer")
        offer_id = offer_response.json()["id"]

        import_response = client.post(
            f"/api/v1/offers/{offer_id}/import-package",
            headers=headers,
            json={
                "package_id": package_id,
                "clear_existing_items": True,
            },
        )
        expect_status(import_response, 200, "import package")

        agreement_response = client.post(
            f"/api/v1/offers/{offer_id}/convert-to-agreement",
            headers=headers,
            json={
                "agreement_notes": "Müşteri onayı ile anlaşmaya çevrildi.",
            },
        )
        expect_status(agreement_response, 200, "convert to agreement")
        agreement = agreement_response.json()

        assert agreement["status"] == "agreement", agreement
        assert agreement["event_id"] is not None, agreement
        event_id = agreement["event_id"]

        event_detail_response = client.get(
            f"/api/v1/events/{event_id}/detail",
            headers=headers,
        )
        expect_status(event_detail_response, 200, "event detail")
        event_detail = event_detail_response.json()

        assert event_detail["event"]["id"] == event_id, event_detail
        assert event_detail["event"]["status"] == "planned", event_detail
        assert event_detail["items"], event_detail

        print("Agreement creates event file smoke test passed.")
        print("Created event id:", event_id)
        print("Registered event routes:", event_routes)
    finally:
        cleanup_records(offer_id=offer_id, event_id=event_id)


if __name__ == "__main__":
    main()
