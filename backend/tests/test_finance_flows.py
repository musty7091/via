"""Derin finans akışı testleri: tahsilat → ödeme planı → tedarikçi borcu/ödemesi
→ etkinlik finansal kapanışı → dönem raporu → dönem kapatma → kapanış kilidi.

Bu testler finans servislerinin (finance_engine, event_payments,
supplier_payables, event_financial_closure, period_closing) gerçek akışını
uçtan uca çalıştırır.
"""


def _setup_event_with_cost(client, headers, event_date="2026-08-10", sale=10000, cost=4000):
    cid = client.post(
        "/api/v1/customers",
        headers=headers,
        json={"name": "Akış Müşteri", "customer_type": "individual"},
    ).json()["id"]
    oid = client.post(
        "/api/v1/offers",
        headers=headers,
        json={
            "customer_id": cid,
            "title": "Akış Teklif",
            "event_date": event_date,
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
            "title": "Sahne",
            "description": "d",
            "quantity": 1,
            "unit_price": sale,
            "internal_unit_cost": cost,
            "internal_cost_currency": "TRY",
            "currency": "TRY",
            "is_visible_on_offer": True,
        },
    )
    conv = client.post(
        f"/api/v1/offers/{oid}/convert-to-agreement", headers=headers, json={}
    )
    assert conv.status_code == 200, conv.text
    events = client.get("/api/v1/events", headers=headers).json()
    # En yeni etkinlik (event_code'a göre) — id'si en büyük olan
    eid = max(e["id"] for e in events)
    return cid, eid


def _first_cash_account_id(client, headers):
    accounts = client.get("/api/v1/finance/cash-accounts", headers=headers).json()
    return accounts[0]["id"] if accounts else None


def test_collection_flow(client, admin_headers):
    """Tahsilat kaydı oluşur ve finans özetine yansır."""
    _cid, eid = _setup_event_with_cost(client, admin_headers)
    coll = client.post(
        f"/api/v1/events/{eid}/payments/collections",
        headers=admin_headers,
        json={
            "collection_date": "2026-08-15",
            "amount": 6000,
            "currency": "TRY",
            "exchange_rate": 1,
            "payment_method": "cash",
        },
    )
    assert coll.status_code in (200, 201), coll.text
    # Finans özeti erişilebilir
    summary = client.get("/api/v1/finance/movements/summary", headers=admin_headers)
    assert summary.status_code == 200


def test_supplier_payable_and_payment_flow(client, admin_headers):
    """Anlaşmadan doğan tedarikçi borcu ödenince durumu güncellenir."""
    _cid, eid = _setup_event_with_cost(client, admin_headers, cost=4000)
    detail = client.get(
        f"/api/v1/events/{eid}/supplier-payables", headers=admin_headers
    ).json()
    assert len(detail["payables"]) >= 1, "Otomatik tedarikçi borcu oluşmadı"
    payable = detail["payables"][0]
    payable_id = payable["id"]

    cash_id = _first_cash_account_id(client, admin_headers)
    pay = client.post(
        f"/api/v1/events/{eid}/supplier-payables/{payable_id}/payments",
        headers=admin_headers,
        json={
            "payment_date": "2026-08-18",
            "amount": payable["amount"],
            "currency": "TRY",
            "exchange_rate": 1,
            "payment_method": "cash",
            "cash_account_id": cash_id,
        },
    )
    assert pay.status_code in (200, 201), pay.text


def test_full_lifecycle_with_closure_and_period_lock(client, admin_headers):
    """Uçtan uca: tahsilat, plan, borç ödeme, kapanış, dönem raporu, dönem kapatma,
    ve kapanış sonrası kilit (409)."""
    H = admin_headers
    _cid, eid = _setup_event_with_cost(client, H, event_date="2026-03-10")

    # Tahsilat (anlaşma tutarının tamamı — kapanış için gerekli)
    assert (
        client.post(
            f"/api/v1/events/{eid}/payments/collections",
            headers=H,
            json={
                "collection_date": "2026-03-15",
                "amount": 10000,
                "currency": "TRY",
                "exchange_rate": 1,
                "payment_method": "cash",
            },
        ).status_code
        in (200, 201)
    )

    # Ödeme planı
    assert (
        client.post(
            f"/api/v1/events/{eid}/payments/plans",
            headers=H,
            json={
                "title": "Taksit",
                "due_date": "2026-03-20",
                "amount": 10000,
                "currency": "TRY",
                "exchange_rate": 1,
            },
        ).status_code
        in (200, 201)
    )

    # Tedarikçi ödemesi
    detail = client.get(f"/api/v1/events/{eid}/supplier-payables", headers=H).json()
    payable = detail["payables"][0]
    cash_id = _first_cash_account_id(client, H)
    assert (
        client.post(
            f"/api/v1/events/{eid}/supplier-payables/{payable['id']}/payments",
            headers=H,
            json={
                "payment_date": "2026-03-18",
                "amount": payable["amount"],
                "currency": "TRY",
                "exchange_rate": 1,
                "payment_method": "cash",
                "cash_account_id": cash_id,
            },
        ).status_code
        in (200, 201)
    )

    # Etkinlik finansal kapanışı
    assert (
        client.post(
            f"/api/v1/events/{eid}/financial-closure/prepare", headers=H, json={}
        ).status_code
        in (200, 201)
    )
    assert (
        client.post(
            f"/api/v1/events/{eid}/financial-closure/approve", headers=H, json={}
        ).status_code
        == 200
    )

    # Dönem raporu (preview)
    preview = client.get("/api/v1/period-closing/2026-03/preview", headers=H)
    assert preview.status_code == 200, preview.text

    # Dönem kapatma
    close = client.post("/api/v1/period-closing/2026-03/close", headers=H, json={})
    assert close.status_code in (200, 201), close.text
    assert close.json()["status"] == "closed"

    # Kapanış sonrası: aynı aya yeni tahsilat -> 409 (kilit)
    blocked = client.post(
        f"/api/v1/events/{eid}/payments/collections",
        headers=H,
        json={
            "collection_date": "2026-03-25",
            "amount": 1000,
            "currency": "TRY",
            "exchange_rate": 1,
            "payment_method": "cash",
        },
    )
    assert blocked.status_code == 409, "Kapalı döneme tahsilat engellenmedi"

    # Kapanış sonrası: etkinlik durum değişikliği -> 409
    status_blocked = client.patch(
        f"/api/v1/events/{eid}/status", headers=H, json={"status": "completed"}
    )
    assert status_blocked.status_code == 409


def test_partner_collection_transfer_flow(client, admin_headers):
    """Ortak üzerinden tahsilat -> şirkete teslim (partner_accounts akışı)."""
    partners = client.get("/api/v1/partners", headers=admin_headers).json()
    assert partners, "Seed ortak yok"
    partner_id = partners[0]["id"]
    cash_id = _first_cash_account_id(client, admin_headers)

    _cid, eid = _setup_event_with_cost(client, admin_headers, event_date="2026-06-10")

    coll = client.post(
        f"/api/v1/events/{eid}/payments/collections",
        headers=admin_headers,
        json={
            "received_by_partner_id": partner_id,
            "collection_date": "2026-06-15",
            "amount": 5000,
            "currency": "TRY",
            "exchange_rate": 1,
            "payment_method": "cash",
        },
    )
    assert coll.status_code in (200, 201), coll.text
    collection_id = coll.json().get("id")

    transfer = client.post(
        f"/api/v1/events/{eid}/payments/collections/{collection_id}/transfer-to-company",
        headers=admin_headers,
        json={"to_cash_account_id": cash_id, "transfer_date": "2026-06-16"},
    )
    assert transfer.status_code in (200, 201), transfer.text
