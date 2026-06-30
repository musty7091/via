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
        name="Smoke Teklif Müşterisi",
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
        name="Smoke Teklif Paketi",
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
        title="Smoke Açılış Programı",
        program_section="opening",
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


def cleanup_offer(offer_id: int) -> None:
    db = SessionLocal()

    try:
        db.query(OfferItem).filter(OfferItem.offer_id == offer_id).delete(synchronize_session=False)
        db.query(Offer).filter(Offer.id == offer_id).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def main() -> None:
    routes = [route.path for route in app.routes if "offers" in route.path]
    if not routes:
        raise RuntimeError("Offer routes are not registered.")

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

    try:
        offer_response = client.post(
            "/api/v1/offers",
            headers=headers,
            json={
                "customer_id": customer_id,
                "package_id": package_id,
                "title": "Smoke Gala Teklifi",
                "invoice_type": "with_invoice",
                "vat_rate": 16,
                "currency": "TRY",
                "advance_payment_amount": 1000,
                "advance_payment_currency": "TRY",
                "payment_terms": "Kapora peşin, kalan etkinlik öncesi.",
                "customer_visible_notes": "Müşteriye görünecek not.",
                "internal_notes": "Bu not müşteriye görünmez.",
            },
        )
        expect_status(offer_response, 201, "create offer")
        offer = offer_response.json()
        offer_id = offer["id"]

        import_response = client.post(
            f"/api/v1/offers/{offer_id}/import-package",
            headers=headers,
            json={
                "package_id": package_id,
                "clear_existing_items": True,
            },
        )
        expect_status(import_response, 200, "import package")
        detail = import_response.json()

        assert detail["items"], detail
        assert "internal_unit_cost" in detail["items"][0], detail
        assert detail["visible_summaries"], detail

        print_view_response = client.get(
            f"/api/v1/offers/{offer_id}/print-view",
            headers=headers,
        )
        expect_status(print_view_response, 200, "print view")
        print_view = print_view_response.json()

        assert print_view["lines"], print_view
        assert "internal_unit_cost" not in str(print_view), print_view
        assert "internal_total_cost" not in str(print_view), print_view
        assert "Bu not müşteriye görünmez" not in str(print_view), print_view

        agreement_response = client.post(
            f"/api/v1/offers/{offer_id}/convert-to-agreement",
            headers=headers,
            json={
                "agreement_notes": "Anlaşmaya çevrildi.",
            },
        )
        expect_status(agreement_response, 200, "convert to agreement")
        assert agreement_response.json()["status"] == "agreement"

        delete_response = client.delete(
            f"/api/v1/offers/{offer_id}/items/{detail['items'][0]['id']}",
            headers=headers,
        )
        expect_status(delete_response, 200, "deactivate offer item")

        print("Offer and agreement backend smoke test passed.")
        print("Registered offer routes:", routes)
    finally:
        if offer_id is not None:
            cleanup_offer(offer_id)


if __name__ == "__main__":
    main()
