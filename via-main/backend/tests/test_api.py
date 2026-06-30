"""
VIA EVENTS API testleri (gerçek pytest standardı).

Kapsam:
  - Sağlık ve kimlik doğrulama
  - Rol bazlı erişim (RBAC) matrisi
  - #1 regresyon: ortak (partner) yazma işlemleri yalnızca super_admin
  - #3 regresyon: ardışık teklif -> anlaşma çevriminde event_code çakışmaması
"""

def test_health(client):
    resp = client.get("/api/v1/health/ping")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_admin_can_access_users(client, admin_headers):
    assert client.get("/api/v1/users", headers=admin_headers).status_code == 200


def test_rbac_matrix(client, admin_headers, user_headers):
    """Rol matrisi: operasyon/finans/kullanıcı erişimleri beklendiği gibi."""
    acc = user_headers("accounting", "acc_rbac@v.com")
    op = user_headers("operation", "op_rbac@v.com")
    viewer = user_headers("viewer", "view_rbac@v.com")

    # Operasyon okuma herkese açık
    assert client.get("/api/v1/events", headers=acc).status_code == 200
    assert client.get("/api/v1/events", headers=op).status_code == 200
    assert client.get("/api/v1/events", headers=viewer).status_code == 200

    # Finans: accounting erişebilir, operation/viewer 403
    assert client.get("/api/v1/finance/movements/summary", headers=acc).status_code == 200
    assert client.get("/api/v1/finance/movements/summary", headers=op).status_code == 403
    assert client.get("/api/v1/finance/movements/summary", headers=viewer).status_code == 403

    # Kullanıcı yönetimi: yalnızca super_admin
    assert client.get("/api/v1/users", headers=acc).status_code == 403
    assert client.get("/api/v1/users", headers=op).status_code == 403


def test_partner_write_requires_super_admin(client, admin_headers, user_headers):
    """#1 regresyon: ortak oluşturma/güncelleme yalnızca super_admin'e açık."""
    op = user_headers("operation", "op_partner@v.com")

    # Operasyon kullanıcısı ortak oluşturamaz -> 403
    blocked = client.post(
        "/api/v1/partners",
        headers=op,
        json={"full_name": "Yetkisiz Ortak", "ownership_percent": 10},
    )
    assert blocked.status_code == 403

    # Operasyon kullanıcısı yine de ortakları görebilir (okuma açık)
    assert client.get("/api/v1/partners", headers=op).status_code == 200

    # Super admin oluşturabilir -> 201
    created = client.post(
        "/api/v1/partners",
        headers=admin_headers,
        json={"full_name": "Yetkili Ortak", "ownership_percent": 10},
    )
    assert created.status_code == 201


def test_sequential_agreements_have_unique_event_codes(client, admin_headers):
    """#3 regresyon: ardışık teklif->anlaşma çevriminde event_code çakışmaz."""
    cid = client.post(
        "/api/v1/customers",
        headers=admin_headers,
        json={"name": "Çakışma Testi", "customer_type": "individual"},
    ).json()["id"]

    for i in range(4):
        oid = client.post(
            "/api/v1/offers",
            headers=admin_headers,
            json={
                "customer_id": cid,
                "title": f"Teklif {i}",
                "event_date": "2026-08-10",
                "invoice_type": "without_invoice",
                "vat_rate": 0,
                "currency": "TRY",
            },
        ).json()["id"]
        client.post(
            f"/api/v1/offers/{oid}/items",
            headers=admin_headers,
            json={
                "source_type": "manual",
                "title": "Hizmet",
                "description": "Test kalemi",
                "quantity": 1,
                "unit_price": 1000,
                "currency": "TRY",
                "is_visible_on_offer": True,
            },
        )
        resp = client.post(
            f"/api/v1/offers/{oid}/convert-to-agreement",
            headers=admin_headers,
            json={},
        )
        assert resp.status_code == 200, resp.text

    events = client.get("/api/v1/events", headers=admin_headers).json()
    codes = [e["event_code"] for e in events if e.get("event_code")]
    # Hiçbir event_code tekrar etmemeli
    assert len(codes) == len(set(codes)), f"Çakışan event_code'lar: {codes}"
