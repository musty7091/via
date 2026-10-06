"""Aşama 5: etkinlik finans kapanışı ve dönem kapanışı."""

from datetime import timedelta
from decimal import Decimal

import pytest

from app.core import clock
from app.core.permissions import Role
from app.modules.finance.models import CashAccount
from app.modules.finance.reports import trial_balance
from app.modules.partners.models import Partner

F = "/api/v1/finance"
C = "/api/v1/closing"
TODAY = clock.today()


def month_str(day):
    return f"{day.year:04d}-{day.month:02d}"


LAST_MONTH_DAY = TODAY.replace(day=1) - timedelta(days=1)
TWO_MONTHS_AGO_DAY = LAST_MONTH_DAY.replace(day=1) - timedelta(days=1)
LAST_MONTH = month_str(LAST_MONTH_DAY)
TWO_MONTHS_AGO = month_str(TWO_MONTHS_AGO_DAY)
THIS_MONTH = month_str(TODAY)


def next_month(month):
    year, mon = (int(x) for x in month.split("-"))
    return f"{year + (mon == 12):04d}-{mon % 12 + 1:02d}"


@pytest.fixture(autouse=True)
def ledger_ok(db):
    yield
    assert trial_balance(db) == Decimal("0.00")


@pytest.fixture
def partners(db):
    items = [
        Partner(full_name=name, sort_order=i)
        for i, name in enumerate(["Alper", "Volkan", "İbrahim"], 1)
    ]
    db.add_all(items)
    db.flush()
    return items


@pytest.fixture
def admin(make_user, login):
    user = make_user()
    login(user)
    return user


@pytest.fixture
def kasa(db):
    a = CashAccount(name="Kasa", account_type="cash", currency="TRY")
    db.add(a)
    db.flush()
    return a


@pytest.fixture
def event_factory(client, admin, partners):
    def factory(price="100000", cost="40000"):
        artist = client.post(
            "/api/v1/catalog/artists", json={"artist_type": "solo", "name": "Asena"}
        ).json()
        customer = client.post(
            "/api/v1/customers", json={"customer_type": "company", "name": "Merit"}
        ).json()
        offer = client.post(
            "/api/v1/offers",
            json={
                "customer_id": customer["id"],
                "partner_id": partners[0].id,
                "title": "Gala",
                "event_date": TODAY.isoformat(),
                "invoice_type": "without_invoice",
            },
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


def complete(client, event_id):
    assert (
        client.post(f"/api/v1/events/{event_id}/status", json={"action": "complete"}).status_code
        == 200
    )


def collect_all(client, event_id, kasa, amount="100000"):
    r = client.post(
        f"{F}/collections",
        json={
            "event_id": event_id,
            "collection_date": TODAY.isoformat(),
            "amount": amount,
            "currency": "TRY",
            "cash_account_id": kasa.id,
        },
    )
    assert r.status_code == 201, r.text


def owed(client):
    return {p["partner"]["name"]: p["owed_base"] for p in client.get(f"{F}/partners").json()}


# --- Etkinlik kapanışı ---


def test_event_cannot_close_before_completed_and_collected(client, event_factory, kasa):
    event_id = event_factory()

    preview = client.get(f"{C}/events/{event_id}").json()
    assert preview["can_close"] is False
    assert {c["key"]: c["ok"] for c in preview["checks"]} == {
        "completed": False,
        "collected": False,
        "payables": False,
        "operation_report": False,
    }
    assert client.post(f"{C}/events/{event_id}/close", json={}).status_code == 400

    complete(client, event_id)
    collect_all(client, event_id, kasa)
    assert client.get(f"{C}/events/{event_id}").json()["can_close"] is True  # açık borç engel değil


def test_profit_is_split_equally_without_losing_a_kurus(client, event_factory, kasa):
    event_id = event_factory(price="100000", cost="39999.99")
    complete(client, event_id)
    collect_all(client, event_id, kasa)

    result = client.post(f"{C}/events/{event_id}/close", json={"note": "Tamam"}).json()

    closure = result["active_closure"]
    assert closure["profit"] == "60000.01"
    assert [s["share"] for s in closure["shares"]] == ["20000.01", "20000.00", "20000.00"]
    assert owed(client) == {"Alper": "20000.01", "Volkan": "20000.00", "İbrahim": "20000.00"}


def test_loss_is_shared_and_shown_as_partner_debt(client, event_factory, kasa):
    event_id = event_factory(price="100", cost="400")
    complete(client, event_id)
    collect_all(client, event_id, kasa, amount="100")

    client.post(f"{C}/events/{event_id}/close", json={})

    assert owed(client) == {"Alper": "-100.00", "Volkan": "-100.00", "İbrahim": "-100.00"}


def test_closed_event_blocks_profit_changes_but_allows_paying_supplier(client, event_factory, kasa):
    event_id = event_factory()
    complete(client, event_id)
    collect_all(client, event_id, kasa)
    client.post(f"{C}/events/{event_id}/close", json={})

    expense = client.post(
        f"{F}/expenses",
        json={
            "expense_date": TODAY.isoformat(),
            "category": "other",
            "title": "Ek",
            "amount": "100",
            "currency": "TRY",
            "event_id": event_id,
            "paid_by": "company",
            "cash_account_id": kasa.id,
        },
    )
    assert expense.status_code == 400
    assert "finans kapanışı yapıldı" in expense.json()["error"]["message"]

    payable = client.get(f"{F}/events/{event_id}").json()["payables"][0]
    paid = client.post(
        f"{F}/payables/{payable['id']}/payments",
        json={
            "payment_date": TODAY.isoformat(),
            "amount": "40000",
            "currency": "TRY",
            "cash_account_id": kasa.id,
        },
    )
    assert paid.status_code == 201
    assert (
        client.post(f"/api/v1/events/{event_id}/status", json={"action": "reopen"}).status_code
        == 400
    )


def test_reopen_closure_reverses_distribution(client, event_factory, kasa):
    event_id = event_factory()
    complete(client, event_id)
    collect_all(client, event_id, kasa)
    client.post(f"{C}/events/{event_id}/close", json={})

    assert (
        client.post(
            f"{C}/events/{event_id}/reopen", json={"reason": "Ek maliyet geldi"}
        ).status_code
        == 200
    )

    assert owed(client) == {"Alper": "0.00", "Volkan": "0.00", "İbrahim": "0.00"}
    history = client.get(f"{C}/events/{event_id}").json()["history"]
    assert [h["status"] for h in history] == ["reopened"]


def test_write_off_allows_closing_and_reduces_profit(client, event_factory, kasa):
    event_id = event_factory(price="100000", cost="40000")
    complete(client, event_id)
    collect_all(client, event_id, kasa, amount="90000")

    response = client.post(
        f"{C}/events/{event_id}/write-off", json={"reason": "Müşteri iflas etti"}
    )

    assert response.status_code == 200
    preview = response.json()
    assert preview["can_close"] is True
    assert preview["profit"] == "50000.00"  # 100.000 − 40.000 − 10.000 silinen alacak
    assert client.get(f"{F}/events/{event_id}").json()["remaining_amount"] == "0.00"


def test_accounting_cannot_close_event_or_period(client, event_factory, kasa, make_user, login):
    event_id = event_factory()
    client.cookies.clear()
    login(make_user(Role.ACCOUNTING))

    assert client.post(f"{C}/events/{event_id}/close", json={}).status_code == 403
    assert client.post(f"{C}/periods/{LAST_MONTH}/close").status_code == 403


# --- Dönem kapanışı ---


def partner_expense(client, partner, amount, day, **extra):
    r = client.post(
        f"{F}/expenses",
        json={
            "expense_date": day.isoformat(),
            "category": "rent",
            "title": "Kira",
            "amount": amount,
            "currency": "TRY",
            "paid_by": "partner",
            "partner_id": partner.id,
            **extra,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_period_close_shares_general_expenses_and_locks_month(client, admin, partners):
    partner_expense(client, partners[0], "3000", LAST_MONTH_DAY)

    preview = client.get(f"{C}/periods/{LAST_MONTH}").json()
    assert preview["can_close"] is True
    assert preview["general"]["total"] == "-3000.00"

    closed = client.post(f"{C}/periods/{LAST_MONTH}/close")
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"
    # Alper 3.000 ödedi, herkese 1.000 gider düştü
    assert owed(client) == {"Alper": "2000.00", "Volkan": "-1000.00", "İbrahim": "-1000.00"}

    late = client.post(
        f"{F}/expenses",
        json={
            "expense_date": LAST_MONTH_DAY.isoformat(),
            "category": "rent",
            "title": "Geç",
            "amount": "10",
            "currency": "TRY",
            "paid_by": "partner",
            "partner_id": partners[0].id,
        },
    )
    assert late.status_code == 400
    assert "dönemi kapalı" in late.json()["error"]["message"]


def test_current_month_cannot_be_closed(client, admin, partners):
    response = client.post(f"{C}/periods/{THIS_MONTH}/close")

    assert response.status_code == 400
    assert "Ay bitmeden" in response.json()["error"]["message"]


def test_periods_must_be_closed_in_order(client, admin, partners):
    partner_expense(client, partners[0], "300", TWO_MONTHS_AGO_DAY)
    partner_expense(client, partners[0], "300", LAST_MONTH_DAY)

    blocked = client.post(f"{C}/periods/{LAST_MONTH}/close")
    assert blocked.status_code == 400
    assert TWO_MONTHS_AGO in blocked.json()["error"]["message"]

    assert client.post(f"{C}/periods/{TWO_MONTHS_AGO}/close").status_code == 200
    assert client.post(f"{C}/periods/{LAST_MONTH}/close").status_code == 200
    reopen_older = client.post(f"{C}/periods/{TWO_MONTHS_AGO}/reopen", json={"reason": "Düzeltme"})
    assert reopen_older.status_code == 400


def test_period_reopen_reverses_distribution(client, admin, partners):
    partner_expense(client, partners[0], "3000", LAST_MONTH_DAY)
    client.post(f"{C}/periods/{LAST_MONTH}/close")

    reopened = client.post(
        f"{C}/periods/{LAST_MONTH}/reopen", json={"reason": "Fatura eksik girildi"}
    )

    assert reopened.status_code == 200
    assert reopened.json()["status"] == "open"
    assert owed(client) == {"Alper": "3000.00", "Volkan": "0.00", "İbrahim": "0.00"}


def test_spread_expense_is_shared_monthly_and_locked_after_close(client, admin, partners):
    until = next_month(next_month(LAST_MONTH))  # 3 aya bölünür
    expense = partner_expense(
        client, partners[0], "12000", LAST_MONTH_DAY, spread_until=until, title="Yıllık sigorta"
    )

    preview = client.get(f"{C}/periods/{LAST_MONTH}").json()
    assert preview["general"]["direct_expenses"] == "0.00"
    assert preview["general"]["spread_expenses"] == "4000.00"
    client.post(f"{C}/periods/{LAST_MONTH}/close")
    assert owed(client)["Volkan"] == "-1333.33"

    cancel = client.post(f"{F}/expenses/{expense['id']}/cancel", json={"reason": "Hatalı"})
    assert cancel.status_code == 400
    assert client.get(f"{C}/periods/{THIS_MONTH}").json()["general"]["spread_expenses"] == "4000.00"


def test_spread_only_for_general_expenses(client, event_factory, kasa):
    event_id = event_factory()

    response = client.post(
        f"{F}/expenses",
        json={
            "expense_date": TODAY.isoformat(),
            "category": "rent",
            "title": "Kira",
            "amount": "10",
            "currency": "TRY",
            "event_id": event_id,
            "paid_by": "unpaid",
            "spread_until": next_month(THIS_MONTH),
        },
    )

    assert response.status_code == 400


def test_closed_period_report_is_frozen(client, admin, partners):
    partner_expense(client, partners[0], "3000", LAST_MONTH_DAY)
    client.post(f"{C}/periods/{LAST_MONTH}/close")
    partner_expense(client, partners[1], "500", TODAY)

    report = client.get(f"{C}/periods/{LAST_MONTH}").json()

    assert report["status"] == "closed"
    assert report["general"]["total"] == "-3000.00"
    periods = {p["month"]: p["status"] for p in client.get(f"{C}/periods").json()}
    assert periods[LAST_MONTH] == "closed"
    assert periods[THIS_MONTH] == "open"


def test_closed_event_hides_cancel_and_reopen_actions(client, event_factory, kasa):
    event_id = event_factory()
    complete(client, event_id)
    collect_all(client, event_id, kasa)
    assert "reopen" in client.get(f"/api/v1/events/{event_id}").json()["allowed_actions"]

    client.post(f"{C}/events/{event_id}/close", json={})

    assert client.get(f"/api/v1/events/{event_id}").json()["allowed_actions"] == []


# --- Gider türleri: bu ay / tüm sezon / sezon sonuna ---


def test_season_expense_books_past_months_share_in_expense_month(client, admin, partners, db):
    from app.modules.closing.periods import recognized_shares
    from app.modules.finance.models import Expense

    r = partner_expense(client, partners[0], "12000", TODAY, allocation="season", title="Sigorta")
    expense = db.get(Expense, r["id"])
    shares = recognized_shares(expense)
    elapsed = TODAY.month  # sezon Ocak'ta başlar
    assert expense.spread_from == f"{TODAY.year}-01"
    assert expense.spread_until == f"{TODAY.year}-12"
    assert shares[THIS_MONTH] == Decimal(1000 * elapsed)
    assert sum(shares.values()) == Decimal("12000")
    assert min(shares) == THIS_MONTH  # geçmiş aylara kayıt yok


def test_rest_of_season_expense_spreads_until_season_end(client, admin, partners, db):
    from app.modules.closing.periods import recognized_shares
    from app.modules.finance.models import Expense

    r = partner_expense(
        client, partners[0], "1200", TODAY, allocation="rest_of_season", title="Depo"
    )
    expense = db.get(Expense, r["id"])
    shares = recognized_shares(expense)
    remaining_months = 12 - TODAY.month + 1
    assert len(shares) == remaining_months
    assert sum(shares.values()) == Decimal("1200")


def test_season_follows_company_season_start(client, admin, partners, db):
    from app.modules.finance.models import Expense

    client.patch("/api/v1/settings/company", json={"season_start_month": 4})
    r = partner_expense(client, partners[0], "1200", TODAY, allocation="season", title="Lisans")
    expense = db.get(Expense, r["id"])
    first_year = TODAY.year if TODAY.month >= 4 else TODAY.year - 1
    assert expense.spread_from == f"{first_year}-04"
    assert expense.spread_until == f"{first_year + 1}-03"


def test_event_expense_cannot_be_spread(client, event_factory, kasa):
    event_id = event_factory()
    r = client.post(
        f"{F}/expenses",
        json={
            "expense_date": TODAY.isoformat(),
            "category": "transport",
            "title": "Nakliye",
            "amount": "1000",
            "currency": "TRY",
            "event_id": event_id,
            "allocation": "season",
            "paid_by": "unpaid",
        },
    )
    assert r.status_code == 400


def test_general_expenses_view(client, admin, partners):
    partner_expense(client, partners[0], "5000", TODAY, title="Kira")
    partner_expense(client, partners[0], "12000", TODAY, allocation="season", title="Sigorta")

    g = client.get(f"{F}/general-expenses", params={"month": THIS_MONTH}).json()

    assert [d["title"] for d in g["direct"]] == ["Kira"]
    [spread] = g["spread"]
    assert spread["months"] == 12
    assert Decimal(g["month_total"]) == Decimal("5000") + Decimal(spread["this_month"])
    assert len(g["season"]) == 12
