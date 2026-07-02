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


def _close_event(event_id):
    from app.db.database import SessionLocal
    from app.models.event import Event

    db = SessionLocal()
    try:
        ev = db.get(Event, event_id)
        ev.is_period_closed = True
        db.commit()
    finally:
        db.close()


def _setup_event(client, headers):
    cid = client.post(
        "/api/v1/customers",
        headers=headers,
        json={"name": "Kilit2", "customer_type": "individual"},
    ).json()["id"]
    oid = client.post(
        "/api/v1/offers",
        headers=headers,
        json={
            "customer_id": cid,
            "title": "Kilit2",
            "event_date": "2026-09-10",
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
            "title": "S",
            "description": "d",
            "quantity": 1,
            "unit_price": 5000,
            "internal_unit_cost": 2000,
            "internal_cost_currency": "TRY",
            "currency": "TRY",
            "is_visible_on_offer": True,
        },
    )
    client.post(f"/api/v1/offers/{oid}/convert-to-agreement", headers=headers, json={})
    return max(e["id"] for e in client.get("/api/v1/events", headers=headers).json())


def test_closed_period_blocks_expense_create(client, admin_headers):
    """P0: kapatılmış döneme yeni gider eklenemez (409)."""
    from app.db.database import SessionLocal
    from app.models.period import MonthlyPeriod

    db = SessionLocal()
    try:
        p = db.query(MonthlyPeriod).filter(MonthlyPeriod.period_month == "2026-02").first()
        if p is None:
            p = MonthlyPeriod(period_month="2026-02")
            db.add(p)
        p.status = "closed"
        p.is_locked = True
        db.commit()
    finally:
        db.close()

    blocked = client.post(
        "/api/v1/expenses",
        headers=admin_headers,
        json={
            "title": "Kapali Gider",
            "expense_date": "2026-02-10",
            "amount": 300,
            "currency": "TRY",
            "exchange_rate": 1,
            "expense_scope": "period",
            "expense_type": "general",
        },
    )
    assert blocked.status_code == 409, blocked.text


def test_closed_event_blocks_collection_create(client, admin_headers):
    """P0: kapatılmış etkinliğe tahsilat eklenemez (409)."""
    eid = _setup_event(client, admin_headers)
    _close_event(eid)
    blocked = client.post(
        f"/api/v1/events/{eid}/payments/collections",
        headers=admin_headers,
        json={
            "collection_date": "2026-09-15",
            "amount": 1000,
            "currency": "TRY",
            "exchange_rate": 1,
            "payment_method": "cash",
        },
    )
    assert blocked.status_code == 409, blocked.text


def test_closed_event_blocks_collection_cancel(client, admin_headers):
    """P0: kapatılmış etkinlikte tahsilat iptali yapılamaz (409)."""
    eid = _setup_event(client, admin_headers)
    # önce açıkken tahsilat oluştur
    coll = client.post(
        f"/api/v1/events/{eid}/payments/collections",
        headers=admin_headers,
        json={
            "collection_date": "2026-09-15",
            "amount": 1000,
            "currency": "TRY",
            "exchange_rate": 1,
            "payment_method": "cash",
        },
    )
    assert coll.status_code in (200, 201), coll.text
    collection_id = coll.json()["id"]
    # etkinliği kapat
    _close_event(eid)
    blocked = client.post(
        f"/api/v1/events/{eid}/payments/collections/{collection_id}/cancel",
        headers=admin_headers,
        json={"cancellation_reason": "test"},
    )
    assert blocked.status_code == 409, blocked.text


def test_closed_event_blocks_supplier_payable_create(client, admin_headers):
    """P0: kapatılmış etkinliğe sanatçı/hizmet borcu eklenemez (409)."""
    eid = _setup_event(client, admin_headers)
    artist_id = client.post(
        "/api/v1/service-catalog/artists",
        headers=admin_headers,
        json={"name": "Borç Sanatçısı", "artist_type": "solo_artist"},
    ).json()["id"]
    _close_event(eid)
    blocked = client.post(
        f"/api/v1/events/{eid}/supplier-payables",
        headers=admin_headers,
        json={
            "artist_id": artist_id,
            "payable_type": "service",
            "title": "Yeni Borç",
            "amount": 500,
            "currency": "TRY",
            "exchange_rate": 1,
        },
    )
    assert blocked.status_code == 409, blocked.text
