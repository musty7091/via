"""Aşama 7: yönetim raporları."""

from datetime import timedelta
from decimal import Decimal

import pytest

from app.core import clock
from app.core.permissions import Role
from app.modules.finance.models import CashAccount
from app.modules.partners.models import Partner

R = "/api/v1/reports"
TODAY = clock.today()
YEAR = {
    "date_from": TODAY.replace(month=1, day=1).isoformat(),
    "date_to": TODAY.replace(month=12, day=31).isoformat(),
}


@pytest.fixture
def admin(make_user, login):
    user = make_user()
    login(user)
    return user


@pytest.fixture
def partners(db):
    items = [
        Partner(full_name=n, sort_order=i) for i, n in enumerate(["Alper", "Volkan", "İbrahim"], 1)
    ]
    db.add_all(items)
    db.flush()
    return items


@pytest.fixture
def kasa(db):
    account = CashAccount(name="Kasa", account_type="cash", currency="TRY")
    db.add(account)
    db.flush()
    return account


@pytest.fixture
def make_event(client, admin, partners):
    customers: dict[str, int] = {}

    def factory(*, customer="Merit", partner=0, artists=(("Asena", "100000", "40000"),), day=TODAY):
        if customer not in customers:
            customers[customer] = client.post(
                "/api/v1/customers", json={"customer_type": "company", "name": customer}
            ).json()["id"]
        offer = client.post(
            "/api/v1/offers",
            json={
                "customer_id": customers[customer],
                "partner_id": partners[partner].id,
                "title": f"{customer} gecesi",
                "event_date": day.isoformat(),
                "invoice_type": "without_invoice",
            },
        ).json()
        for name, price, cost in artists:
            artist = client.post(
                "/api/v1/catalog/artists", json={"artist_type": "solo", "name": name}
            ).json()
            client.post(
                f"/api/v1/offers/{offer['id']}/lines",
                json={
                    "line_type": "artist",
                    "artist_id": artist["id"],
                    "unit_price": price,
                    "unit_cost": cost,
                },
            )
        client.post(f"/api/v1/offers/{offer['id']}/status", json={"action": "send"})
        return client.post(f"/api/v1/offers/{offer['id']}/convert", json={}).json()["event_id"]

    return factory


def collect(client, event_id, kasa, amount):
    r = client.post(
        "/api/v1/finance/collections",
        json={
            "event_id": event_id,
            "collection_date": TODAY.isoformat(),
            "amount": amount,
            "currency": "TRY",
            "cash_account_id": kasa.id,
        },
    )
    assert r.status_code == 201, r.text


def test_event_report_matches_ledger_and_shows_receivable(client, make_event, kasa):
    first = make_event()
    make_event(customer="Near East", partner=1, artists=(("Sidar", "50000", "60000"),))
    collect(client, first, kasa, "30000")

    report = client.get(f"{R}/events", params=YEAR).json()

    rows = {row["event_id"]: row for row in report["rows"]}
    assert rows[first]["revenue"] == "100000.00"
    assert rows[first]["cost"] == "40000.00"
    assert rows[first]["profit"] == "60000.00"
    assert rows[first]["margin"] == "60.00"
    assert rows[first]["receivable"] == "70000.00"
    assert report["totals"]["profit"] == "50000.00"  # 60.000 − 10.000 zarar
    assert report["receivable"] == "120000.00"


def test_event_report_filters_by_partner_and_skips_cancelled(client, make_event, partners):
    make_event()
    other = make_event(customer="Near East", partner=1)
    cancelled = make_event(customer="Lord Palace", partner=1)
    client.post(f"/api/v1/events/{cancelled}/status", json={"action": "cancel", "note": "Vazgeçti"})

    report = client.get(f"{R}/events", params={**YEAR, "partner_id": partners[1].id}).json()

    assert [row["event_id"] for row in report["rows"]] == [other]


def test_monthly_report_puts_event_result_in_event_month(client, make_event, kasa):
    next_month_day = (TODAY.replace(day=1) + timedelta(days=32)).replace(day=5)
    event_id = make_event(day=next_month_day)
    collect(client, event_id, kasa, "25000")
    this_month = f"{TODAY.year:04d}-{TODAY.month:02d}"
    next_month = f"{next_month_day.year:04d}-{next_month_day.month:02d}"

    report = client.get(f"{R}/monthly", params={"first": this_month, "last": next_month}).json()

    now, later = report["rows"]
    assert now["event_count"] == 0
    assert now["collections"] == "25000.00"
    assert later["event_count"] == 1
    assert later["event_profit"] == "60000.00"
    assert report["totals"]["revenue"] == "100000.00"


def test_monthly_report_includes_general_expenses(client, make_event, partners):
    r = client.post(
        "/api/v1/finance/expenses",
        json={
            "expense_date": TODAY.isoformat(),
            "category": "rent",
            "title": "Ofis kirası",
            "amount": "9000",
            "currency": "TRY",
            "paid_by": "partner",
            "partner_id": partners[0].id,
        },
    )
    assert r.status_code == 201, r.text
    month = f"{TODAY.year:04d}-{TODAY.month:02d}"

    row = client.get(f"{R}/monthly", params={"first": month, "last": month}).json()["rows"][0]

    assert row["general"] == "-9000.00"
    assert row["net"] == "-9000.00"


def test_artist_report_allocates_package_price_by_cost(client, admin, make_event, partners):
    a = client.post("/api/v1/catalog/artists", json={"artist_type": "solo", "name": "Asena"}).json()
    b = client.post(
        "/api/v1/catalog/artists", json={"artist_type": "band", "name": "Frekans"}
    ).json()
    package = client.post(
        "/api/v1/catalog/packages",
        json={"package_type": "program", "name": "Düğün paketi", "price": "120000"},
    ).json()
    for artist, cost in ((a, "30000"), (b, "10000")):
        r = client.post(
            f"/api/v1/catalog/packages/{package['id']}/items",
            json={"component_type": "artist", "artist_id": artist["id"], "unit_cost": cost},
        )
        assert r.status_code == 201, r.text
    customer = client.post(
        "/api/v1/customers", json={"customer_type": "individual", "name": "Kaya Ailesi"}
    ).json()
    offer = client.post(
        "/api/v1/offers",
        json={
            "customer_id": customer["id"],
            "partner_id": partners[0].id,
            "title": "Düğün",
            "event_date": TODAY.isoformat(),
            "invoice_type": "without_invoice",
        },
    ).json()
    r = client.post(f"/api/v1/offers/{offer['id']}/packages", json={"package_id": package["id"]})
    assert r.status_code in (200, 201), r.text
    client.post(f"/api/v1/offers/{offer['id']}/status", json={"action": "send"})
    client.post(f"/api/v1/offers/{offer['id']}/convert", json={})

    rows = {r["artist"]["name"]: r for r in client.get(f"{R}/artists", params=YEAR).json()}

    assert rows["Asena"]["sales"] == "90000.00"
    assert rows["Asena"]["margin"] == "60000.00"
    assert rows["Frekans"]["sales"] == "30000.00"
    assert Decimal(rows["Asena"]["sales"]) + Decimal(rows["Frekans"]["sales"]) == 120000


def test_customer_report_ranks_by_revenue(client, make_event, kasa):
    first = make_event(customer="Merit")
    make_event(customer="Merit")
    make_event(customer="Near East", artists=(("Sidar", "250000", "100000"),))
    collect(client, first, kasa, "100000")

    rows = client.get(f"{R}/customers", params=YEAR).json()

    assert [r["customer"]["name"] for r in rows] == ["Near East", "Merit"]
    merit = rows[1]
    assert merit["event_count"] == 2
    assert merit["collected"] == "100000.00"
    assert merit["receivable"] == "100000.00"


def test_invalid_ranges_are_rejected(client, admin):
    r = client.get(f"{R}/events", params={"date_from": "2026-12-01", "date_to": "2026-01-01"})
    assert r.status_code == 400
    r = client.get(f"{R}/monthly", params={"first": "2020-01", "last": "2026-01"})
    assert r.status_code == 400


def test_operation_role_cannot_see_reports(client, make_user, login):
    login(make_user(Role.OPERATION))
    assert client.get(f"{R}/monthly").status_code == 403


def test_period_summary_ties_out_with_the_books(client, make_event, kasa, partners):
    event_id = make_event(artists=(("Asena", "100000", "40000"),))
    collect(client, event_id, kasa, "60000")
    month = f"{TODAY.year:04d}-{TODAY.month:02d}"

    s = client.get(f"{R}/period-summary", params={"month": month}).json()

    assert s["position"]["cash_base"] == "60000.00"
    assert s["position"]["receivables_base"] == "40000.00"
    assert s["position"]["payables_base"] == "40000.00"
    assert s["profitability"]["event_profit"] == "60000.00"
    [receivable] = s["receivables"]
    assert receivable["remaining"] == "40000.00"
    assert receivable["collected"] == "60000.00"
    assert [c["currency"] for c in s["currencies"]] == ["TRY"]
    assert {p["name"] for p in s["partners"]} == {"Alper", "Volkan", "İbrahim"}
    flow = {f["label"]: f for f in s["cash_flow"]}
    assert flow["Tahsilat"]["inflow_base"] == "60000.00"


def test_period_summary_partner_holding_cash_is_reported(client, make_event, partners):
    event_id = make_event()
    r = client.post(
        "/api/v1/finance/collections",
        json={
            "event_id": event_id,
            "collection_date": TODAY.isoformat(),
            "amount": "25000",
            "currency": "TRY",
            "partner_id": partners[1].id,
        },
    )
    assert r.status_code == 201, r.text
    month = f"{TODAY.year:04d}-{TODAY.month:02d}"

    s = client.get(f"{R}/period-summary", params={"month": month}).json()

    volkan = next(p for p in s["partners"] if p["name"] == "Volkan")
    assert volkan["closing_held"] == "25000.00"
    assert volkan["net"] == "-25000.00"
    assert any("Volkan üzerinde" in w for w in s["warnings"])
