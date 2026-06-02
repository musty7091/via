from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def expect_status(response, expected_status: int, label: str):
    if response.status_code != expected_status:
        raise RuntimeError(
            f"{label} failed. Expected {expected_status}, got {response.status_code}. Body: {response.text}"
        )


def main() -> None:
    route_paths = [route.path for route in app.routes if "customers" in route.path]
    if not route_paths:
        raise RuntimeError("Customer routes are not registered.")

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

    customer_response = client.post(
        "/api/v1/customers",
        headers=headers,
        json={
            "customer_type": "hotel",
            "customer_status": "active",
            "name": "Frekans Test Hotel",
            "short_name": "Frekans Hotel",
            "tax_number": "1234567890",
            "tax_office": "Lefkosa",
            "phone": "+90 392 000 00 00",
            "email": "test@viaevents.com",
            "country": "KKTC",
            "city": "Lefkosa",
            "district": "Merkez",
            "default_invoice_type": "select_on_event",
            "default_currency": "TRY",
            "risk_level": "normal",
            "notes": "Smoke test customer",
        },
    )
    expect_status(customer_response, 201, "create customer")
    customer_id = customer_response.json()["id"]

    list_response = client.get("/api/v1/customers", headers=headers)
    expect_status(list_response, 200, "list customers")

    contact_response = client.post(
        f"/api/v1/customers/{customer_id}/contacts",
        headers=headers,
        json={
            "full_name": "Ali Veli",
            "title": "Etkinlik Sorumlusu",
            "contact_role": "event_responsible",
            "phone": "+90 533 000 00 00",
            "whatsapp_phone": "+90 533 000 00 00",
            "email": "ali.veli@viaevents.com",
            "is_primary_contact": True,
            "is_operation_contact": True,
        },
    )
    expect_status(contact_response, 201, "create customer contact")

    venue_response = client.post(
        f"/api/v1/customers/{customer_id}/venues",
        headers=headers,
        json={
            "name": "Frekans Ana Salon",
            "venue_type": "hotel",
            "country": "KKTC",
            "city": "Lefkosa",
            "district": "Merkez",
            "capacity": 500,
            "contact_name": "Ali Veli",
            "contact_phone": "+90 533 000 00 00",
        },
    )
    expect_status(venue_response, 201, "create customer venue")

    debit_response = client.post(
        f"/api/v1/customers/{customer_id}/ledger",
        headers=headers,
        json={
            "movement_date": "2026-06-01",
            "movement_type": "event_charge",
            "direction": "debit",
            "title": "Etkinlik bedeli",
            "description": "Frekans konseri",
            "detail_note": "Etkinlik kesinleşti. İşlemi oluşturan: VIA Admin",
            "amount": 120000,
            "currency": "TRY",
            "exchange_rate": 1,
        },
    )
    expect_status(debit_response, 201, "create debit ledger movement")

    first_credit_response = client.post(
        f"/api/v1/customers/{customer_id}/ledger",
        headers=headers,
        json={
            "movement_date": "2026-06-05",
            "movement_type": "deposit_collection",
            "direction": "credit",
            "title": "Kapora tahsilatı",
            "description": "Frekans konseri",
            "detail_note": "Tahsilatı yapan: Ortak 1",
            "amount": 40000,
            "currency": "TRY",
            "exchange_rate": 1,
            "payment_method": "cash",
            "collected_by_partner_id": 1,
        },
    )
    expect_status(first_credit_response, 201, "create first credit ledger movement")

    final_credit_response = client.post(
        f"/api/v1/customers/{customer_id}/ledger",
        headers=headers,
        json={
            "movement_date": "2026-06-20",
            "movement_type": "final_collection",
            "direction": "credit",
            "title": "Kalan tahsilat",
            "description": "Frekans konseri",
            "detail_note": "Tahsilatı yapan: Ortak 2",
            "amount": 80000,
            "currency": "TRY",
            "exchange_rate": 1,
            "payment_method": "bank_transfer",
            "collected_by_partner_id": 2,
        },
    )
    expect_status(final_credit_response, 201, "create final credit ledger movement")

    ledger_response = client.get(f"/api/v1/customers/{customer_id}/ledger", headers=headers)
    expect_status(ledger_response, 200, "list ledger")
    ledger = ledger_response.json()

    assert len(ledger) == 3, ledger
    assert ledger[0]["running_balance_base_amount"] == 120000
    assert ledger[1]["running_balance_base_amount"] == 80000
    assert ledger[2]["running_balance_base_amount"] == 0
    assert ledger[1]["collected_by_partner_name"] == "Ortak 1"
    assert ledger[2]["collected_by_partner_name"] == "Ortak 2"

    summary_response = client.get(
        f"/api/v1/customers/{customer_id}/ledger/summary",
        headers=headers,
    )
    expect_status(summary_response, 200, "ledger summary")
    summary = summary_response.json()

    assert summary["total_debit_base_amount"] == 120000
    assert summary["total_credit_base_amount"] == 120000
    assert summary["balance_base_amount"] == 0
    assert summary["movement_count"] == 3

    print("Customer backend API smoke test passed.")
    print("Registered customer routes:", route_paths)
    print("Ledger running balances:", [item["running_balance_base_amount"] for item in ledger])


if __name__ == "__main__":
    main()
