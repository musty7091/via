import pytest

from app.core.permissions import Role


@pytest.fixture
def admin(make_user, login):
    user = make_user()
    login(user)
    return user


def create(client, path, payload):
    response = client.post(f"/api/v1/catalog/{path}", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def artist(client, **overrides):
    return create(
        client,
        "artists",
        {
            "artist_type": "solo",
            "name": "Asena",
            "default_cost": "40000.00",
            "cost_currency": "TRY",
            "default_price": "60000.00",
            "price_currency": "TRY",
            **overrides,
        },
    )


def package(client, **overrides):
    return create(
        client,
        "packages",
        {"package_type": "combo", "name": "Yaza Merhaba", "price": "300000", **overrides},
    )


def test_iban_is_normalized(client, admin):
    supplier = create(client, "suppliers", {"name": "Frekans Ses", "iban": "tr12 0006 2000 0001"})

    assert supplier["iban"] == "TR12000620000001"


def test_money_with_more_than_two_decimals_is_rejected(client, admin):
    response = client.post(
        "/api/v1/catalog/artists",
        json={"artist_type": "solo", "name": "Asena", "default_cost": "100.005"},
    )

    assert response.status_code == 422


def test_negative_money_is_rejected(client, admin):
    response = client.post(
        "/api/v1/catalog/packages",
        json={"package_type": "combo", "name": "Paket", "price": "-1"},
    )

    assert response.status_code == 422


def test_rider_items_are_ordered_and_editable(client, admin):
    a = artist(client)
    url = f"/api/v1/catalog/artists/{a['id']}/rider-items"
    client.post(url, json={"category": "backstage", "title": "Ayna ve ütü", "sort_order": 20})
    first = client.post(
        url, json={"category": "technical", "title": "2 adet monitör", "sort_order": 10}
    )
    client.patch(f"{url}/{first.json()['id']}", json={"is_required": False})

    detail = client.get(f"/api/v1/catalog/artists/{a['id']}").json()

    assert [r["title"] for r in detail["rider_items"]] == ["2 adet monitör", "Ayna ve ütü"]
    assert detail["rider_items"][0]["is_required"] is False


def test_package_item_uses_artist_default_cost(client, admin):
    a = artist(client)
    p = package(client)

    detail = client.post(
        f"/api/v1/catalog/packages/{p['id']}/items",
        json={"component_type": "artist", "artist_id": a["id"]},
    ).json()

    item = detail["items"][0]
    assert item["title"] == "Asena"
    assert item["unit_cost"] == "40000.00"
    assert item["cost_currency"] == "TRY"


def test_package_item_manual_cost_keeps_artist_currency(client, admin):
    a = artist(client, cost_currency="EUR", default_cost="1000")
    p = package(client)

    detail = client.post(
        f"/api/v1/catalog/packages/{p['id']}/items",
        json={"component_type": "artist", "artist_id": a["id"], "unit_cost": "1200"},
    ).json()

    assert detail["items"][0]["cost_currency"] == "EUR"


def test_package_summary_profit_in_same_currency(client, admin):
    a = artist(client)
    p = package(client)
    url = f"/api/v1/catalog/packages/{p['id']}/items"
    client.post(url, json={"component_type": "artist", "artist_id": a["id"]})
    detail = client.post(
        url,
        json={
            "component_type": "custom",
            "title": "Sahne kurulumu",
            "unit_cost": "5000",
            "quantity": "2",
        },
    ).json()

    summary = detail["summary"]
    assert summary["costs"] == [{"amount": "50000.00", "currency": "TRY"}]
    assert summary["gross_profit"] == "250000.00"
    assert summary["margin_percent"] == "83.3"
    assert summary["needs_exchange_rate"] is False


def test_package_summary_requires_rate_for_foreign_costs(client, admin):
    a = artist(client, cost_currency="EUR", default_cost="2000")
    p = package(client)

    detail = client.post(
        f"/api/v1/catalog/packages/{p['id']}/items",
        json={"component_type": "artist", "artist_id": a["id"]},
    ).json()

    assert detail["summary"]["gross_profit"] is None
    assert detail["summary"]["needs_exchange_rate"] is True


def test_inactive_artist_cannot_be_added_to_package(client, admin):
    a = artist(client)
    client.patch(f"/api/v1/catalog/artists/{a['id']}", json={"is_active": False})
    p = package(client)

    response = client.post(
        f"/api/v1/catalog/packages/{p['id']}/items",
        json={"component_type": "artist", "artist_id": a["id"]},
    )

    assert response.status_code == 400
    assert "pasif" in response.json()["error"]["message"]


@pytest.mark.parametrize(
    "payload",
    [
        {"component_type": "artist"},
        {"component_type": "artist", "artist_id": 1, "service_id": 1},
        {"component_type": "custom"},
        {"component_type": "custom", "title": "X", "start_time": "21:00"},
    ],
)
def test_invalid_package_items_are_rejected(client, admin, payload):
    p = package(client)

    response = client.post(f"/api/v1/catalog/packages/{p['id']}/items", json=payload)

    assert response.status_code == 422


def test_package_item_can_be_removed(client, admin):
    p = package(client)
    url = f"/api/v1/catalog/packages/{p['id']}/items"
    item = client.post(url, json={"component_type": "custom", "title": "Işık"}).json()["items"][0]

    detail = client.delete(f"{url}/{item['id']}").json()

    assert detail["items"] == []


def test_operation_sees_catalog_without_costs(client, make_user, login):
    login(make_user())
    a = artist(client)
    p = package(client)
    client.post(
        f"/api/v1/catalog/packages/{p['id']}/items",
        json={"component_type": "artist", "artist_id": a["id"]},
    )
    client.cookies.clear()
    login(make_user(Role.OPERATION))

    artist_view = client.get(f"/api/v1/catalog/artists/{a['id']}").json()
    package_view = client.get(f"/api/v1/catalog/packages/{p['id']}").json()

    assert artist_view["default_cost"] is None
    assert artist_view["default_price"] == "60000.00"
    assert package_view["summary"] is None
    assert package_view["items"][0]["unit_cost"] is None
    assert client.get("/api/v1/catalog/suppliers").status_code == 403
    assert (
        client.post("/api/v1/catalog/artists", json={"artist_type": "dj", "name": "X"}).status_code
        == 403
    )


def test_partner_can_manage_catalog(client, make_user, login):
    login(make_user(Role.PARTNER))

    assert artist(client)["name"] == "Asena"


def test_artist_manager_partner_must_exist(client, admin):
    response = client.post(
        "/api/v1/catalog/artists",
        json={"artist_type": "band", "name": "Grup Frekans", "manager_partner_id": 9999},
    )

    assert response.status_code == 400


def test_package_item_with_stage_times_is_saved_and_audited(client, admin):
    p = package(client)

    response = client.post(
        f"/api/v1/catalog/packages/{p['id']}/items",
        json={
            "component_type": "custom",
            "title": "Kapanış",
            "start_time": "23:45",
            "end_time": "01:00",
        },
    )

    assert response.status_code == 201
    assert response.json()["items"][0]["start_time"] == "23:45:00"
    logs = client.get("/api/v1/audit-logs", params={"entity_type": "package"}).json()
    assert logs["items"][0]["changes"]["start_time"] == "23:45:00"


def test_supplier_detail(client, admin):
    created = client.post("/api/v1/catalog/suppliers", json={"name": "Işık Pro"}).json()
    assert client.get(f"/api/v1/catalog/suppliers/{created['id']}").json()["name"] == "Işık Pro"
    assert client.get("/api/v1/catalog/suppliers/999999").status_code == 404
