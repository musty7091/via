"""Gider Decimal düzeltmesi (#1) ve dönem kilidi kapsamı (#2) testleri."""


def _create_event(client, headers):
    cid = client.post(
        "/api/v1/customers",
        headers=headers,
        json={"name": "Kilit Test", "customer_type": "individual"},
    ).json()["id"]
    oid = client.post(
        "/api/v1/offers",
        headers=headers,
        json={
            "customer_id": cid,
            "title": "Kilit Teklif",
            "event_date": "2026-08-10",
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
            "quantity": 1,
            "unit_price": 1000,
            "currency": "TRY",
            "is_visible_on_offer": True,
        },
    )
    client.post(f"/api/v1/offers/{oid}/convert-to-agreement", headers=headers, json={})
    events = client.get("/api/v1/events", headers=headers).json()
    return events[0]["id"] if events else None


def test_expense_creation_decimal(client, admin_headers):
    """#1 regresyon: gider oluşturma çökmez, base_amount doğru (Decimal × rate)."""
    resp = client.post(
        "/api/v1/expenses",
        headers=admin_headers,
        json={
            "title": "Ofis Gideri",
            "expense_date": "2026-07-15",
            "amount": 1500.50,
            "currency": "TRY",
            "exchange_rate": 1,
            "expense_scope": "period",
            "expense_type": "general",
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    base = data.get("expense", data).get("base_amount")
    assert abs(base - 1500.5) < 1e-9


def test_closed_event_blocks_status_change(client, admin_headers):
    """#2: kapatılmış döneme ait etkinliğin durumu değiştirilemez (409)."""
    from app.db.database import SessionLocal
    from app.models.event import Event

    event_id = _create_event(client, admin_headers)
    assert event_id is not None

    # Etkinliği kapalı döneme ait işaretle
    db = SessionLocal()
    try:
        ev = db.get(Event, event_id)
        ev.is_period_closed = True
        db.commit()
    finally:
        db.close()

    blocked = client.patch(
        f"/api/v1/events/{event_id}/status",
        headers=admin_headers,
        json={"status": "completed"},
    )
    assert blocked.status_code == 409


def test_closed_period_blocks_expense_cancel(client, admin_headers):
    """#2: kapatılmış döneme tarihli giderin iptali engellenir (409)."""
    from app.db.database import SessionLocal
    from app.models.period import MonthlyPeriod

    created = client.post(
        "/api/v1/expenses",
        headers=admin_headers,
        json={
            "title": "Kapali Donem Gideri",
            "expense_date": "2026-01-15",
            "amount": 500,
            "currency": "TRY",
            "exchange_rate": 1,
            "expense_scope": "period",
            "expense_type": "general",
        },
    ).json()
    expense_id = created.get("expense", created).get("id")

    # Dönemi kapat (get-or-create ile test izolasyonu)
    db = SessionLocal()
    try:
        period = (
            db.query(MonthlyPeriod)
            .filter(MonthlyPeriod.period_month == "2026-01")
            .first()
        )
        if period is None:
            period = MonthlyPeriod(period_month="2026-01")
            db.add(period)
        period.status = "closed"
        period.is_locked = True
        db.commit()
    finally:
        db.close()

    blocked = client.post(
        f"/api/v1/expenses/{expense_id}/cancel",
        headers=admin_headers,
        json={"cancellation_reason": "test"},
    )
    assert blocked.status_code == 409
