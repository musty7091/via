import pytest

from app.core.permissions import Role
from app.core.text import fold

CUSTOMER = {"customer_type": "hotel", "name": "Kaya Düğün Organizasyon", "city": "Girne"}


@pytest.fixture
def admin(make_user, login):
    user = make_user()
    login(user)
    return user


def create_customer(client, **overrides):
    response = client.post("/api/v1/customers", json={**CUSTOMER, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def test_fold_handles_turkish_characters():
    assert fold("İBRAHİM Şahin", "Düğün") == "ibrahim sahin dugun"
    assert fold("ISPARTA ılık") == "isparta ilik"


def test_search_finds_customer_without_turkish_characters(client, admin):
    create_customer(client)
    create_customer(client, name="Merit Park Hotel")

    found = client.get("/api/v1/customers", params={"search": "kaya dugun"}).json()

    assert [c["name"] for c in found["items"]] == ["Kaya Düğün Organizasyon"]


def test_search_escapes_like_wildcards(client, admin):
    create_customer(client)

    assert client.get("/api/v1/customers", params={"search": "%"}).json()["total"] == 0


def test_blank_optional_fields_are_saved_as_null(client, admin):
    customer = create_customer(client, phone="  ", email="")

    assert customer["phone"] is None
    assert customer["email"] is None


def test_patch_can_clear_optional_field_but_ignores_null_required(client, admin):
    customer = create_customer(client)

    response = client.patch(
        f"/api/v1/customers/{customer['id']}", json={"city": None, "name": None}
    )

    assert response.status_code == 200
    assert response.json()["city"] is None
    assert response.json()["name"] == CUSTOMER["name"]


def test_inactive_customers_hidden_by_default(client, admin):
    customer = create_customer(client)
    client.patch(f"/api/v1/customers/{customer['id']}", json={"is_active": False})

    assert client.get("/api/v1/customers").json()["total"] == 0
    assert client.get("/api/v1/customers", params={"is_active": False}).json()["total"] == 1


def test_first_contact_becomes_primary_and_only_one_primary_exists(client, admin):
    customer = create_customer(client)
    url = f"/api/v1/customers/{customer['id']}/contacts"

    first = client.post(url, json={"full_name": "Ayşe Kaya"}).json()
    second = client.post(url, json={"full_name": "Mehmet Kaya", "is_primary": True}).json()

    assert first["is_primary"] is True
    detail = client.get(f"/api/v1/customers/{customer['id']}").json()
    primaries = [c["full_name"] for c in detail["contacts"] if c["is_primary"]]
    assert primaries == ["Mehmet Kaya"]
    listed = client.get("/api/v1/customers").json()["items"][0]
    assert listed["primary_contact_name"] == "Mehmet Kaya"
    assert second["is_primary"] is True


def test_deactivated_contact_loses_primary_flag(client, admin):
    customer = create_customer(client)
    url = f"/api/v1/customers/{customer['id']}/contacts"
    contact = client.post(url, json={"full_name": "Ayşe Kaya"}).json()

    updated = client.patch(f"{url}/{contact['id']}", json={"is_active": False}).json()

    assert updated["is_primary"] is False


def test_contact_must_belong_to_customer(client, admin):
    first = create_customer(client)
    second = create_customer(client, name="Başka Müşteri")
    contact = client.post(
        f"/api/v1/customers/{first['id']}/contacts", json={"full_name": "Ayşe"}
    ).json()

    response = client.patch(
        f"/api/v1/customers/{second['id']}/contacts/{contact['id']}", json={"title": "Müdür"}
    )

    assert response.status_code == 404


def test_venue_linked_to_customer_appears_in_customer_detail(client, admin):
    customer = create_customer(client)
    venue = client.post(
        "/api/v1/venues",
        json={
            "name": "Kaya Palace Balo Salonu",
            "venue_type": "hall",
            "customer_id": customer["id"],
        },
    )
    assert venue.status_code == 201

    detail = client.get(f"/api/v1/customers/{customer['id']}").json()

    assert detail["venues"][0]["name"] == "Kaya Palace Balo Salonu"
    assert detail["venues"][0]["customer_name"] == customer["name"]


def test_venue_with_unknown_customer_is_rejected(client, admin):
    response = client.post(
        "/api/v1/venues", json={"name": "Sahil", "venue_type": "beach", "customer_id": 99999}
    )

    assert response.status_code == 400


def test_operation_can_view_but_not_change_customers(client, make_user, login):
    login(make_user())
    customer = create_customer(client)
    client.cookies.clear()
    login(make_user(Role.OPERATION))

    assert client.get(f"/api/v1/customers/{customer['id']}").status_code == 200
    assert client.post("/api/v1/customers", json=CUSTOMER).status_code == 403


def test_customer_changes_are_audited(client, admin):
    customer = create_customer(client)
    client.patch(f"/api/v1/customers/{customer['id']}", json={"risk_level": "blocked"})

    logs = client.get(
        "/api/v1/audit-logs", params={"entity_type": "customer", "entity_id": customer["id"]}
    ).json()

    assert logs["items"][0]["changes"] == {"risk_level": {"before": "normal", "after": "blocked"}}
