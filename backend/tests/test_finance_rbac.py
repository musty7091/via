"""Finans/Decimal hassasiyeti, RBAC ve denetim (audit) testleri."""

import json


def _make_offer_with_item(client, headers, unit_price, quantity, cost=0):
    cid = client.post(
        "/api/v1/customers",
        headers=headers,
        json={"name": "Test Müşteri", "customer_type": "individual"},
    ).json()["id"]
    oid = client.post(
        "/api/v1/offers",
        headers=headers,
        json={
            "customer_id": cid,
            "title": "Test Teklif",
            "event_date": "2026-09-01",
            "invoice_type": "without_invoice",
            "vat_rate": 0,
            "currency": "TRY",
        },
    ).json()["id"]
    client.post(
        f"/api/v1/offers/{oid}/items",
        headers=headers,
        json={
            "source_type": "manual",
            "title": "Kalem",
            "description": "d",
            "quantity": quantity,
            "unit_price": unit_price,
            "internal_unit_cost": cost,
            "internal_cost_currency": "TRY",
            "currency": "TRY",
            "is_visible_on_offer": True,
        },
    )
    return oid


def test_money_serializes_as_number_and_is_exact(client, admin_headers):
    """Decimal hassasiyeti: 2 x 100.10 = 200.20, JSON'da SAYI (string değil)."""
    oid = _make_offer_with_item(client, admin_headers, unit_price=100.10, quantity=2)
    raw = client.get(f"/api/v1/offers/{oid}/detail", headers=admin_headers).text
    data = json.loads(raw)
    amount = data["offer"]["amount"]
    # Sayı olmalı (string değil)
    assert isinstance(amount, (int, float))
    # Tam değer
    assert abs(amount - 200.2) < 1e-9


def test_offer_convert_creates_event_with_code(client, admin_headers):
    oid = _make_offer_with_item(client, admin_headers, unit_price=1000, quantity=1, cost=300)
    resp = client.post(
        f"/api/v1/offers/{oid}/convert-to-agreement", headers=admin_headers, json={}
    )
    assert resp.status_code == 200
    events = client.get("/api/v1/events", headers=admin_headers).json()
    assert any(e.get("event_code") for e in events)


def test_login_rejects_bad_credentials(client):
    bad = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@viaevents.com", "password": "yanlis-sifre"},
    )
    assert bad.status_code == 401


def test_finance_access_by_role(client, admin_headers, user_headers):
    pm = user_headers("partner_manager", "pm_fin@v.com")
    viewer = user_headers("viewer", "viewer_fin@v.com")
    # partner_manager finansı görebilir
    assert (
        client.get("/api/v1/finance/movements/summary", headers=pm).status_code == 200
    )
    # viewer finansa erişemez
    assert (
        client.get("/api/v1/finance/movements/summary", headers=viewer).status_code
        == 403
    )


def test_audit_records_delete(client, admin_headers):
    from app.db.database import SessionLocal
    from app.models.system import AuditLog

    created = client.post(
        "/api/v1/showcase/artists",
        headers=admin_headers,
        json={"category": "solo", "name": "Silinecek"},
    ).json()
    client.delete(f"/api/v1/showcase/artists/{created['id']}", headers=admin_headers)

    db = SessionLocal()
    try:
        found = (
            db.query(AuditLog)
            .filter(AuditLog.action == "DELETE", AuditLog.table_name == "showcase")
            .count()
        )
        assert found >= 1
    finally:
        db.close()
