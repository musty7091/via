from decimal import Decimal

import pytest

from app.core.permissions import Role
from app.modules.partners.models import Partner


@pytest.fixture
def admin(make_user, login):
    user = make_user()
    login(user)
    return user


@pytest.fixture
def partner(db):
    p = Partner(full_name="Alper", sort_order=1)
    db.add(p)
    db.flush()
    return p


@pytest.fixture
def customer(client, admin):
    return client.post(
        "/api/v1/customers",
        json={"customer_type": "hotel", "name": "Merit Park", "default_invoice": "with_invoice"},
    ).json()


def make_offer(client, customer, partner, **overrides):
    payload = {
        "customer_id": customer["id"],
        "partner_id": partner.id,
        "title": "Yılbaşı Gecesi",
        "event_date": "2026-12-31",
        **overrides,
    }
    response = client.post("/api/v1/offers", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def add_custom(client, offer, price="100000", **overrides):
    response = client.post(
        f"/api/v1/offers/{offer['id']}/lines",
        json={"line_type": "custom", "title": "Organizasyon", "unit_price": price, **overrides},
    )
    assert response.status_code == 201, response.text
    return response.json()


def act(client, offer, action, note=None):
    return client.post(
        f"/api/v1/offers/{offer['id']}/status", json={"action": action, "note": note}
    )


def catalog_package(client):
    artist = client.post(
        "/api/v1/catalog/artists",
        json={"artist_type": "solo", "name": "Asena", "default_cost": "80000"},
    ).json()
    eur_artist = client.post(
        "/api/v1/catalog/artists",
        json={
            "artist_type": "solo",
            "name": "Sidar",
            "default_cost": "2500",
            "cost_currency": "EUR",
        },
    ).json()
    package = client.post(
        "/api/v1/catalog/packages",
        json={"package_type": "combo", "name": "Yaza Merhaba", "price": "300000"},
    ).json()
    url = f"/api/v1/catalog/packages/{package['id']}/items"
    client.post(url, json={"component_type": "artist", "artist_id": artist["id"]})
    client.post(url, json={"component_type": "artist", "artist_id": eur_artist["id"]})
    return package


# --- Oluşturma ---


def test_offer_uses_customer_and_company_defaults(client, customer, partner):
    offer = make_offer(client, customer, partner)

    assert offer["offer_no"].startswith("VIA-T-")
    assert offer["status"] == "draft"
    assert offer["invoice_type"] == "with_invoice"
    assert offer["vat_rate"] == "16.00"
    assert offer["currency"] == "TRY"
    assert offer["exchange_rate"] == "1.000000"
    assert "edit" in offer["allowed_actions"]


def test_offer_numbers_are_sequential(client, customer, partner):
    first = make_offer(client, customer, partner)["offer_no"]
    second = make_offer(client, customer, partner)["offer_no"]

    assert int(second[-4:]) == int(first[-4:]) + 1


def test_foreign_currency_offer_requires_rate(client, customer, partner):
    response = client.post(
        "/api/v1/offers",
        json={
            "customer_id": customer["id"],
            "partner_id": partner.id,
            "title": "Gala",
            "currency": "EUR",
        },
    )

    assert response.status_code == 400
    assert "kuru" in response.json()["error"]["message"]


def test_changing_currency_without_rate_does_not_reuse_old_rate(client, customer, partner):
    offer = make_offer(client, customer, partner)

    response = client.patch(f"/api/v1/offers/{offer['id']}", json={"currency": "EUR"})

    assert response.status_code == 400


def test_blocked_customer_cannot_get_offer(client, customer, partner):
    client.patch(f"/api/v1/customers/{customer['id']}", json={"risk_level": "blocked"})

    response = client.post(
        "/api/v1/offers",
        json={"customer_id": customer["id"], "partner_id": partner.id, "title": "Gala"},
    )

    assert response.status_code == 400
    assert "engelli" in response.json()["error"]["message"]


def test_partner_is_required_when_user_is_not_a_partner(client, customer):
    response = client.post("/api/v1/offers", json={"customer_id": customer["id"], "title": "Gala"})

    assert response.status_code == 400
    assert "ortağı" in response.json()["error"]["message"]


def test_partner_user_defaults_to_own_partner(client, make_user, login, db):
    user = make_user(Role.PARTNER)
    own = Partner(full_name="Volkan", user_id=user.id)
    db.add(own)
    db.flush()
    login(user)
    customer = client.post(
        "/api/v1/customers", json={"customer_type": "company", "name": "Near East"}
    ).json()

    offer = client.post("/api/v1/offers", json={"customer_id": customer["id"], "title": "Gala"})

    assert offer.json()["partner"]["name"] == "Volkan"


# --- Tutarlar ---


def test_totals_with_discount_and_vat(client, customer, partner):
    offer = make_offer(client, customer, partner, discount_amount="0")
    add_custom(client, offer, price="50000", quantity="2")
    detail = client.patch(f"/api/v1/offers/{offer['id']}", json={"discount_amount": "10000"}).json()

    assert detail["subtotal"] == "100000.00"
    assert detail["net_amount"] == "90000.00"
    assert detail["vat_amount"] == "14400.00"
    assert detail["total_amount"] == "104400.00"


def test_without_invoice_has_no_vat(client, customer, partner):
    offer = make_offer(client, customer, partner, invoice_type="without_invoice")

    detail = add_custom(client, offer)

    assert detail["vat_amount"] == "0.00"
    assert detail["total_amount"] == "100000.00"


def test_advance_cannot_exceed_total(client, customer, partner):
    offer = make_offer(client, customer, partner)
    add_custom(client, offer)

    response = client.patch(f"/api/v1/offers/{offer['id']}", json={"advance_amount": "999999"})

    assert response.status_code == 400


def test_hidden_line_cannot_have_price(client, customer, partner):
    offer = make_offer(client, customer, partner)

    response = client.post(
        f"/api/v1/offers/{offer['id']}/lines",
        json={
            "line_type": "custom",
            "title": "Ekip yemeği",
            "unit_price": "500",
            "is_visible": False,
        },
    )

    assert response.status_code == 400


def test_artist_line_uses_catalog_price_and_cost(client, customer, partner):
    artist = client.post(
        "/api/v1/catalog/artists",
        json={
            "artist_type": "solo",
            "name": "Asena",
            "default_cost": "80000",
            "default_price": "120000",
        },
    ).json()
    offer = make_offer(client, customer, partner, invoice_type="without_invoice")

    detail = client.post(
        f"/api/v1/offers/{offer['id']}/lines",
        json={"line_type": "artist", "artist_id": artist["id"]},
    ).json()

    line = detail["lines"][0]
    assert line["unit_price"] == "120000.00"
    assert line["unit_cost"] == "80000.00"
    assert detail["profitability"]["profit_base"] == "40000.00"


# --- Paket ---


def test_package_import_needs_rate_for_foreign_costs(client, customer, partner):
    package = catalog_package(client)
    offer = make_offer(client, customer, partner)

    response = client.post(
        f"/api/v1/offers/{offer['id']}/packages", json={"package_id": package["id"]}
    )

    assert response.status_code == 400
    assert "EUR" in response.json()["error"]["message"]


def test_package_is_one_price_and_components_are_included(client, customer, partner):
    package = catalog_package(client)
    offer = make_offer(client, customer, partner, invoice_type="without_invoice")

    detail = client.post(
        f"/api/v1/offers/{offer['id']}/packages",
        json={"package_id": package["id"], "cost_rates": {"EUR": "36.5"}},
    ).json()

    header = [line for line in detail["lines"] if line["line_type"] == "package"][0]
    components = [line for line in detail["lines"] if line["parent_id"] == header["id"]]
    assert detail["subtotal"] == "300000.00"
    assert len(components) == 2
    assert all(c["unit_price"] == "0.00" for c in components)
    # 80.000 TL + 2.500 EUR × 36,5 = 171.250 TL maliyet
    assert detail["profitability"]["cost_base"] == "171250.00"
    assert detail["profitability"]["profit_base"] == "128750.00"


def test_package_component_cannot_be_priced(client, customer, partner):
    package = catalog_package(client)
    offer = make_offer(client, customer, partner)
    detail = client.post(
        f"/api/v1/offers/{offer['id']}/packages",
        json={"package_id": package["id"], "cost_rates": {"EUR": "36.5"}},
    ).json()
    component = next(line for line in detail["lines"] if line["line_type"] == "package_component")

    response = client.patch(
        f"/api/v1/offers/{offer['id']}/lines/{component['id']}", json={"unit_price": "1000"}
    )

    assert response.status_code == 400


def test_deleting_package_removes_its_components(client, customer, partner):
    package = catalog_package(client)
    offer = make_offer(client, customer, partner)
    detail = client.post(
        f"/api/v1/offers/{offer['id']}/packages",
        json={"package_id": package["id"], "cost_rates": {"EUR": "36.5"}},
    ).json()
    header = next(line for line in detail["lines"] if line["line_type"] == "package")

    detail = client.delete(f"/api/v1/offers/{offer['id']}/lines/{header['id']}").json()

    assert detail["lines"] == []
    assert detail["total_amount"] == "0.00"


# --- Durumlar ---


def test_empty_offer_cannot_be_sent(client, customer, partner):
    offer = make_offer(client, customer, partner)

    assert act(client, offer, "send").status_code == 400


def test_sent_offer_is_locked_until_reopened(client, customer, partner):
    offer = make_offer(client, customer, partner)
    add_custom(client, offer)
    assert act(client, offer, "send").status_code == 200

    locked = client.post(
        f"/api/v1/offers/{offer['id']}/lines",
        json={"line_type": "custom", "title": "Ek", "unit_price": "1"},
    )
    assert locked.status_code == 400
    assert act(client, offer, "reopen").status_code == 200
    assert add_custom(client, offer)["status"] == "draft"


def test_reject_and_cancel_require_reason(client, customer, partner):
    offer = make_offer(client, customer, partner)
    add_custom(client, offer)
    act(client, offer, "send")

    assert act(client, offer, "reject").status_code == 400
    assert act(client, offer, "reject", "Bütçe yetersiz").json()["status_note"] == "Bütçe yetersiz"


def test_cancelled_offers_hidden_from_default_list(client, customer, partner):
    offer = make_offer(client, customer, partner)
    act(client, offer, "cancel", "Yanlış müşteri")

    assert client.get("/api/v1/offers").json()["total"] == 0
    assert client.get("/api/v1/offers", params={"status": "cancelled"}).json()["total"] == 1


# --- Anlaşma ---


def test_draft_offer_cannot_be_converted(client, customer, partner):
    offer = make_offer(client, customer, partner)
    add_custom(client, offer)

    assert client.post(f"/api/v1/offers/{offer['id']}/convert", json={}).status_code == 400


def test_convert_freezes_amounts_in_base_currency(client, customer, partner):
    offer = make_offer(
        client, customer, partner, currency="EUR", exchange_rate="36.452100", advance_amount="0"
    )
    add_custom(client, offer, price="10000", unit_cost="4000", cost_currency="EUR")
    client.patch(f"/api/v1/offers/{offer['id']}", json={"advance_amount": "2000"})
    act(client, offer, "send")

    result = client.post(f"/api/v1/offers/{offer['id']}/convert", json={"note": "Kapora alındı"})

    assert result.status_code == 201
    event = client.get(f"/api/v1/events/{result.json()['event_id']}").json()
    assert event["event_no"].startswith("VIA-E-")
    assert event["currency"] == "EUR"
    assert event["net_amount"] == "10000.00"
    assert event["total_amount"] == "11600.00"
    # Eski sistemdeki hata: EUR tutar TL sanılıyordu. Doğrusu kurla çevrilmiş tutar:
    assert event["base_net_amount"] == "364521.00"
    assert event["base_total_amount"] == "422844.36"
    assert event["remaining_amount"] == "9600.00"
    assert event["profitability"]["cost_base"] == "145808.40"


def test_converted_offer_cannot_change_or_convert_again(client, customer, partner):
    offer = make_offer(client, customer, partner)
    add_custom(client, offer)
    act(client, offer, "send")
    client.post(f"/api/v1/offers/{offer['id']}/convert", json={})

    detail = client.get(f"/api/v1/offers/{offer['id']}").json()
    assert detail["status"] == "converted"
    assert detail["allowed_actions"] == ["duplicate"]
    assert client.post(f"/api/v1/offers/{offer['id']}/convert", json={}).status_code == 400
    assert act(client, offer, "cancel", "x").status_code == 400
    assert client.patch(f"/api/v1/offers/{offer['id']}", json={"title": "Yeni"}).status_code == 400


def test_convert_copies_package_structure(client, customer, partner):
    package = catalog_package(client)
    offer = make_offer(client, customer, partner)
    client.post(
        f"/api/v1/offers/{offer['id']}/packages",
        json={"package_id": package["id"], "cost_rates": {"EUR": "36.5"}},
    )
    act(client, offer, "send")

    event_id = client.post(f"/api/v1/offers/{offer['id']}/convert", json={}).json()["event_id"]
    items = client.get(f"/api/v1/events/{event_id}").json()["items"]

    header = next(i for i in items if i["line_type"] == "package")
    assert [i["title"] for i in items if i["parent_id"] == header["id"]] == ["Asena", "Sidar"]


def test_convert_requires_event_date(client, customer, partner):
    offer = make_offer(client, customer, partner, event_date=None)
    add_custom(client, offer)
    act(client, offer, "send")

    response = client.post(f"/api/v1/offers/{offer['id']}/convert", json={})

    assert response.status_code == 400
    assert "tarihi" in response.json()["error"]["message"]


def test_duplicate_creates_new_draft_with_lines(client, customer, partner):
    package = catalog_package(client)
    offer = make_offer(client, customer, partner)
    client.post(
        f"/api/v1/offers/{offer['id']}/packages",
        json={"package_id": package["id"], "cost_rates": {"EUR": "36.5"}},
    )
    act(client, offer, "cancel", "Revize edilecek")

    copy = client.post(f"/api/v1/offers/{offer['id']}/duplicate").json()

    assert copy["status"] == "draft"
    assert copy["offer_no"] != offer["offer_no"]
    header = next(line for line in copy["lines"] if line["line_type"] == "package")
    assert sum(1 for line in copy["lines"] if line["parent_id"] == header["id"]) == 2
    assert copy["subtotal"] == "300000.00"


# --- Yazdırma ve yetkiler ---


def test_print_hides_costs_and_hidden_lines(client, customer, partner):
    package = catalog_package(client)
    offer = make_offer(client, customer, partner)
    client.post(
        f"/api/v1/offers/{offer['id']}/packages",
        json={"package_id": package["id"], "cost_rates": {"EUR": "36.5"}},
    )
    add_custom(client, offer, price="0", title="Ekip yemeği", is_visible=False, unit_cost="3000")

    printed = client.get(f"/api/v1/offers/{offer['id']}/print")

    assert printed.status_code == 200
    body = printed.json()
    assert [line["title"] for line in body["lines"]] == ["Yaza Merhaba"]
    assert body["lines"][0]["components"][0]["unit_price"] is None
    assert "cost" not in printed.text


def test_accounting_can_view_but_not_create_offers(client, customer, partner, make_user, login):
    offer = make_offer(client, customer, partner)
    client.cookies.clear()
    login(make_user(Role.ACCOUNTING))

    assert client.get(f"/api/v1/offers/{offer['id']}").status_code == 200
    assert client.post("/api/v1/offers", json={"customer_id": 1, "title": "X"}).status_code == 403


def test_operation_sees_event_without_money(client, customer, partner, make_user, login):
    offer = make_offer(client, customer, partner)
    add_custom(client, offer, unit_cost="20000")
    act(client, offer, "send")
    event_id = client.post(f"/api/v1/offers/{offer['id']}/convert", json={}).json()["event_id"]
    client.cookies.clear()
    login(make_user(Role.OPERATION))

    event = client.get(f"/api/v1/events/{event_id}").json()

    assert event["total_amount"] == "0"
    assert event["profitability"] is None
    assert event["items"][0]["unit_cost"] is None
    assert client.get(f"/api/v1/offers/{offer['id']}").status_code == 403


def test_event_cancel_requires_reason_and_locks_edits(client, customer, partner):
    offer = make_offer(client, customer, partner)
    add_custom(client, offer)
    act(client, offer, "send")
    event_id = client.post(f"/api/v1/offers/{offer['id']}/convert", json={}).json()["event_id"]
    url = f"/api/v1/events/{event_id}"

    assert client.post(f"{url}/status", json={"action": "cancel"}).status_code == 400
    assert (
        client.post(f"{url}/status", json={"action": "cancel", "note": "Müşteri vazgeçti"}).json()[
            "status"
        ]
        == "cancelled"
    )
    assert client.patch(url, json={"guest_count": 200}).status_code == 400


def test_amounts_use_decimal_not_float(client, customer, partner):
    offer = make_offer(client, customer, partner, invoice_type="with_invoice")

    detail = add_custom(client, offer, price="0.10", quantity="3")

    assert Decimal(detail["subtotal"]) == Decimal("0.30")
    assert detail["vat_amount"] == "0.05"


def test_advance_can_be_entered_before_lines_but_is_checked_on_send(client, customer, partner):
    offer = make_offer(client, customer, partner, advance_amount="50000")

    small = add_custom(client, offer, price="1000")

    assert small["advance_amount"] == "50000.00"
    assert act(client, offer, "send").status_code == 400
    add_custom(client, offer, price="99000")
    assert act(client, offer, "send").status_code == 200
