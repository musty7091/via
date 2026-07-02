"""Vitrin (showcase) testleri: public erişim, admin yetkisi, CRUD, görünürlük."""


def test_public_showcase_needs_no_auth(client):
    assert client.get("/api/v1/public/showcase/categories").status_code == 200
    assert client.get("/api/v1/public/showcase/artists").status_code == 200


def test_admin_showcase_requires_auth(client):
    # Token yok -> 401
    assert client.get("/api/v1/showcase/artists").status_code == 401


def test_showcase_admin_requires_super_admin(client, admin_headers, user_headers):
    op = user_headers("operation", "op_showcase@v.com")
    blocked = client.post(
        "/api/v1/showcase/artists",
        headers=op,
        json={"category": "dj", "name": "Yetkisiz"},
    )
    assert blocked.status_code == 403

    created = client.post(
        "/api/v1/showcase/artists",
        headers=admin_headers,
        json={"category": "dj", "name": "Yetkili DJ"},
    )
    assert created.status_code == 201


def test_showcase_crud_and_public_visibility(client, admin_headers):
    # Oluştur (aktif)
    created = client.post(
        "/api/v1/showcase/artists",
        headers=admin_headers,
        json={
            "category": "gruplar",
            "name": "Grup Görünürlük",
            "tagline": "Test",
            "is_active": True,
        },
    ).json()
    aid = created["id"]

    # Public'te görünür
    cats = client.get("/api/v1/public/showcase/categories").json()
    assert any(c["key"] == "gruplar" for c in cats)
    public = client.get("/api/v1/public/showcase/artists?category=gruplar").json()
    assert any(a["id"] == aid for a in public)

    # Pasifleştir -> public'te görünmez
    client.put(
        f"/api/v1/showcase/artists/{aid}",
        headers=admin_headers,
        json={"is_active": False},
    )
    public2 = client.get("/api/v1/public/showcase/artists?category=gruplar").json()
    assert all(a["id"] != aid for a in public2)

    # Admin listesinde hâlâ var (pasif dahil)
    admin_list = client.get("/api/v1/showcase/artists", headers=admin_headers).json()
    assert any(a["id"] == aid for a in admin_list)

    # Sil
    assert (
        client.delete(f"/api/v1/showcase/artists/{aid}", headers=admin_headers).status_code
        == 204
    )
