"""Muhasebe motoru testleri.

Her testin sonunda defterin toplamı (borç − alacak) sıfır olmalıdır; `ledger_ok`
fixture'ı bunu otomatik kontrol eder.
"""

from datetime import timedelta
from decimal import Decimal

import pytest

from app.core import clock
from app.core.permissions import Role
from app.modules.closing.models import AccountingPeriod, PeriodStatus
from app.modules.closing.service import month_key
from app.modules.finance.models import CashAccount
from app.modules.finance.reports import trial_balance
from app.modules.partners.models import Partner

API = "/api/v1/finance"
TODAY = clock.today().isoformat()


@pytest.fixture(autouse=True)
def ledger_ok(db):
    yield
    assert trial_balance(db) == Decimal("0.00"), "Defter dengesiz!"


@pytest.fixture
def admin(make_user, login):
    user = make_user()
    login(user)
    return user


@pytest.fixture
def alper(db):
    p = Partner(full_name="Alper", sort_order=1)
    db.add(p)
    db.flush()
    return p


@pytest.fixture
def kasa(db):
    a = CashAccount(name="Merkez Kasa", account_type="cash", currency="TRY")
    db.add(a)
    db.flush()
    return a


@pytest.fixture
def euro_kasa(db):
    a = CashAccount(name="Euro Kasa", account_type="cash", currency="EUR")
    db.add(a)
    db.flush()
    return a


@pytest.fixture
def make_event(client, admin, alper):
    """Anlaşmaya çevrilmiş etkinlik oluşturur; (event, finance) döner."""

    def factory(
        *,
        price="100000",
        cost="40000",
        currency="TRY",
        rate=None,
        invoice="without_invoice",
        advance="0",
    ):
        artist = client.post(
            "/api/v1/catalog/artists",
            json={"artist_type": "solo", "name": "Asena", "cost_currency": currency},
        ).json()
        customer = client.post(
            "/api/v1/customers", json={"customer_type": "company", "name": "Merit Park"}
        ).json()
        offer = client.post(
            "/api/v1/offers",
            json={
                "customer_id": customer["id"],
                "partner_id": alper.id,
                "title": "Gala",
                "event_date": (clock.today() + timedelta(days=30)).isoformat(),
                "currency": currency,
                "exchange_rate": rate,
                "invoice_type": invoice,
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
        if advance != "0":
            client.patch(f"/api/v1/offers/{offer['id']}", json={"advance_amount": advance})
        client.post(f"/api/v1/offers/{offer['id']}/status", json={"action": "send"})
        result = client.post(f"/api/v1/offers/{offer['id']}/convert", json={})
        assert result.status_code == 201, result.text
        event_id = result.json()["event_id"]
        return event_id

    return factory


def finance(client, event_id):
    return client.get(f"{API}/events/{event_id}").json()


def overview(client):
    return client.get(f"{API}/overview").json()


def collect(client, event_id, amount, **kw):
    payload = {
        "event_id": event_id,
        "collection_date": TODAY,
        "amount": amount,
        "currency": "TRY",
        **kw,
    }
    return client.post(f"{API}/collections", json=payload)


# --- Anlaşma ---


def test_agreement_posts_receivable_revenue_vat_and_payables(client, make_event):
    event_id = make_event(price="100000", cost="40000", invoice="with_invoice", advance="30000")

    fin = finance(client, event_id)

    assert fin["total_amount"] == "116000.00"
    assert fin["receivable_base"] == "116000.00"
    assert fin["revenue_base"] == "100000.00"
    assert fin["cost_base"] == "40000.00"
    assert fin["profit_base"] == "60000.00"
    assert overview(client)["totals"]["vat_payable_base"] == "16000.00"
    assert [p["title"] for p in fin["payables"]] == ["Asena"]
    assert fin["payables"][0]["payee"]["name"] == "Asena"
    assert [(p["title"], p["amount"]) for p in fin["plans"]] == [
        ("Kapora", "30000.00"),
        ("Kalan ödeme", "86000.00"),
    ]
    assert fin["plan_difference"] == "0.00"


# --- Tahsilat ---


def test_collection_into_cash_reduces_receivable(client, make_event, kasa):
    event_id = make_event()

    response = collect(client, event_id, "30000", cash_account_id=kasa.id)

    assert response.status_code == 201
    fin = finance(client, event_id)
    assert fin["collected_amount"] == "30000.00"
    assert fin["remaining_amount"] == "70000.00"
    assert fin["plans"][0]["state"] == "partial"
    accounts = overview(client)["cash_accounts"]
    assert accounts[0]["balance"] == "30000.00"


@pytest.mark.parametrize(
    ("amount", "extra", "message"),
    [
        ("100000.01", {}, "fazla tahsilat"),
        (
            "100",
            {"collection_date": (clock.today() + timedelta(days=1)).isoformat()},
            "İleri tarihli",
        ),
    ],
)
def test_invalid_collections_are_rejected(client, make_event, kasa, amount, extra, message):
    event_id = make_event()

    response = collect(client, event_id, amount, cash_account_id=kasa.id, **extra)

    assert response.status_code == 400
    assert message in response.json()["error"]["message"]


def test_collection_currency_must_match_cash_account(client, make_event, euro_kasa):
    event_id = make_event()

    response = collect(client, event_id, "100", cash_account_id=euro_kasa.id)

    assert response.status_code == 400


def test_partner_collection_then_handover(client, make_event, kasa, alper):
    event_id = make_event()
    collect(client, event_id, "50000", partner_id=alper.id)

    held = client.get(f"{API}/partners").json()[0]
    assert held["held"] == [{"currency": "TRY", "amount": "50000.00"}]

    too_much = client.post(
        f"{API}/partner-transactions",
        json={
            "kind": "handover",
            "partner_id": alper.id,
            "tx_date": TODAY,
            "amount": "60000",
            "currency": "TRY",
            "cash_account_id": kasa.id,
        },
    )
    assert too_much.status_code == 400
    ok = client.post(
        f"{API}/partner-transactions",
        json={
            "kind": "handover",
            "partner_id": alper.id,
            "tx_date": TODAY,
            "amount": "50000",
            "currency": "TRY",
            "cash_account_id": kasa.id,
        },
    )
    assert ok.status_code == 201
    totals = overview(client)["totals"]
    assert totals["partner_held_base"] == "0.00"
    assert totals["cash_base"] == "50000.00"


def test_collection_cannot_be_cancelled_after_partner_handed_money_over(
    client, make_event, kasa, alper
):
    """Eski sistemde bu işlem ortak bakiyesini eksiye düşürüp kasayı bozuyordu."""
    event_id = make_event()
    collection = collect(client, event_id, "50000", partner_id=alper.id).json()
    client.post(
        f"{API}/partner-transactions",
        json={
            "kind": "handover",
            "partner_id": alper.id,
            "tx_date": TODAY,
            "amount": "50000",
            "currency": "TRY",
            "cash_account_id": kasa.id,
        },
    )

    response = client.post(
        f"{API}/collections/{collection['id']}/cancel", json={"reason": "Hatalı giriş"}
    )

    assert response.status_code == 400
    assert "teslim" in response.json()["error"]["message"]


def test_cancelled_collection_is_reversed_not_deleted(client, make_event, kasa):
    event_id = make_event()
    collection = collect(client, event_id, "30000", cash_account_id=kasa.id).json()

    cancelled = client.post(
        f"{API}/collections/{collection['id']}/cancel", json={"reason": "Hatalı giriş"}
    )

    assert cancelled.json()["status"] == "cancelled"
    assert finance(client, event_id)["remaining_amount"] == "100000.00"
    movements = client.get(f"{API}/cash-accounts/{kasa.id}/movements").json()
    assert [m["amount"] for m in movements] == ["30000.00", "-30000.00"]
    assert movements[1]["is_reversal"] is True
    again = client.post(f"{API}/collections/{collection['id']}/cancel", json={"reason": "Tekrar"})
    assert again.status_code == 400


def test_euro_event_collection_books_fx_difference_and_clears_receivable(
    client, make_event, euro_kasa
):
    event_id = make_event(price="1000", cost="0", currency="EUR", rate="36")

    collect(client, event_id, "333.33", currency="EUR", rate="37", cash_account_id=euro_kasa.id)
    collect(client, event_id, "666.67", currency="EUR", rate="37", cash_account_id=euro_kasa.id)

    fin = finance(client, event_id)
    assert fin["remaining_amount"] == "0.00"
    assert fin["receivable_base"] == "0.00"  # kuruş artığı kalmaz
    assert fin["fx_base"] == "1000.00"  # 1000 € × (37 − 36)
    assert fin["profit_base"] == "37000.00"


def test_try_payment_for_euro_event_requires_covered_amount(client, make_event, kasa):
    event_id = make_event(price="1000", cost="0", currency="EUR", rate="36")

    missing = collect(client, event_id, "18000", cash_account_id=kasa.id)
    ok = collect(client, event_id, "18000", cash_account_id=kasa.id, applied_amount="500")

    assert missing.status_code == 400
    assert ok.status_code == 201
    assert finance(client, event_id)["remaining_amount"] == "500.00"


# --- Borç ve ödeme ---


def test_supplier_payment_needs_cash_and_cannot_overpay(client, make_event, kasa):
    event_id = make_event(price="100000", cost="40000")
    payable = finance(client, event_id)["payables"][0]
    url = f"{API}/payables/{payable['id']}/payments"
    pay = {"payment_date": TODAY, "currency": "TRY", "cash_account_id": kasa.id}

    no_cash = client.post(url, json={**pay, "amount": "10000"})
    assert no_cash.status_code == 400
    assert "yeterli bakiye" in no_cash.json()["error"]["message"]

    collect(client, event_id, "100000", cash_account_id=kasa.id)
    assert client.post(url, json={**pay, "amount": "15000"}).json()["state"] == "partial"
    assert client.post(url, json={**pay, "amount": "30000"}).status_code == 400
    assert client.post(url, json={**pay, "amount": "25000"}).json()["state"] == "paid"
    assert overview(client)["totals"]["payables_base"] == "0.00"
    assert overview(client)["cash_accounts"][0]["balance"] == "60000.00"


def test_partner_pays_supplier_then_company_offsets_and_pays_back(client, make_event, kasa, alper):
    event_id = make_event(price="100000", cost="40000")
    payable = finance(client, event_id)["payables"][0]
    client.post(
        f"{API}/payables/{payable['id']}/payments",
        json={"payment_date": TODAY, "amount": "40000", "currency": "TRY", "partner_id": alper.id},
    )
    collect(client, event_id, "25000", partner_id=alper.id)

    balance = client.get(f"{API}/partners").json()[0]
    assert balance["owed_base"] == "40000.00"
    assert balance["held_base"] == "25000.00"

    tx = {"partner_id": alper.id, "tx_date": TODAY, "currency": "TRY"}
    offset = client.post(
        f"{API}/partner-transactions", json={**tx, "kind": "offset", "amount": "25000"}
    )
    assert offset.status_code == 201
    collect(client, event_id, "75000", cash_account_id=kasa.id)
    payout = client.post(
        f"{API}/partner-transactions",
        json={**tx, "kind": "payout", "amount": "15000", "cash_account_id": kasa.id},
    )
    assert payout.status_code == 201

    balance = client.get(f"{API}/partners").json()[0]
    assert balance["held_base"] == "0.00"
    assert balance["owed_base"] == "0.00"
    statement = client.get(f"{API}/partners/{alper.id}/statement").json()
    # cepten ödeme (1) + ortağa tahsilat (1) + mahsup (2) + ortağa ödeme (1)
    assert len(statement) == 5


def test_payable_amount_adjustment_posts_difference(client, make_event, kasa):
    event_id = make_event(price="100000", cost="40000")
    payable = finance(client, event_id)["payables"][0]

    updated = client.patch(f"{API}/payables/{payable['id']}", json={"amount": "45000"}).json()

    assert updated["amount"] == "45000.00"
    assert finance(client, event_id)["cost_base"] == "45000.00"
    collect(client, event_id, "50000", cash_account_id=kasa.id)
    client.post(
        f"{API}/payables/{payable['id']}/payments",
        json={
            "payment_date": TODAY,
            "amount": "20000",
            "currency": "TRY",
            "cash_account_id": kasa.id,
        },
    )
    below_paid = client.patch(f"{API}/payables/{payable['id']}", json={"amount": "10000"})
    assert below_paid.status_code == 400


# --- Gider ---


def test_expense_paid_by_company_partner_or_unpaid(client, make_event, kasa, alper):
    event_id = make_event()
    collect(client, event_id, "10000", cash_account_id=kasa.id)
    base = {"expense_date": TODAY, "category": "transport", "currency": "TRY", "event_id": event_id}

    company = client.post(
        f"{API}/expenses",
        json={
            **base,
            "title": "Transfer",
            "amount": "2000",
            "paid_by": "company",
            "cash_account_id": kasa.id,
        },
    )
    partner = client.post(
        f"{API}/expenses",
        json={
            **base,
            "title": "Yakıt",
            "amount": "500",
            "paid_by": "partner",
            "partner_id": alper.id,
        },
    )
    unpaid = client.post(
        f"{API}/expenses", json={**base, "title": "Minibüs", "amount": "3000", "paid_by": "unpaid"}
    )

    assert company.status_code == partner.status_code == unpaid.status_code == 201
    assert unpaid.json()["payable_id"] is not None
    fin = finance(client, event_id)
    assert fin["expense_base"] == "5500.00"
    assert fin["profit_base"] == "54500.00"  # 100.000 − 40.000 − 5.500
    assert overview(client)["cash_accounts"][0]["balance"] == "8000.00"
    assert client.get(f"{API}/partners").json()[0]["owed_base"] == "500.00"


def test_unpaid_expense_cannot_be_cancelled_after_payment(client, make_event, kasa):
    event_id = make_event()
    collect(client, event_id, "10000", cash_account_id=kasa.id)
    expense = client.post(
        f"{API}/expenses",
        json={
            "expense_date": TODAY,
            "category": "other",
            "title": "Ses ek",
            "amount": "3000",
            "currency": "TRY",
            "paid_by": "unpaid",
        },
    ).json()
    client.post(
        f"{API}/payables/{expense['payable_id']}/payments",
        json={
            "payment_date": TODAY,
            "amount": "3000",
            "currency": "TRY",
            "cash_account_id": kasa.id,
        },
    )

    response = client.post(f"{API}/expenses/{expense['id']}/cancel", json={"reason": "Hatalı"})

    assert response.status_code == 400


def test_company_expense_cannot_overdraw_cash(client, kasa, admin):
    response = client.post(
        f"{API}/expenses",
        json={
            "expense_date": TODAY,
            "category": "rent",
            "title": "Ofis kirası",
            "amount": "1",
            "currency": "TRY",
            "paid_by": "company",
            "cash_account_id": kasa.id,
        },
    )

    assert response.status_code == 400


# --- Etkinlik iptali ---


def test_event_cancel_reverses_agreement(client, make_event, kasa):
    """Parası alınmamış etkinliğin iptali: anlaşma ve borçlar tamamen geri alınır.
    (Kaporalı iptal: test_cancel_and_dates.py)"""
    event_id = make_event()
    url = f"/api/v1/events/{event_id}/status"
    assert (
        client.post(url, json={"action": "cancel", "note": "Müşteri vazgeçti"}).status_code == 200
    )
    totals = overview(client)["totals"]
    assert totals["receivables_base"] == "0.00"
    assert totals["payables_base"] == "0.00"
    assert finance(client, event_id)["profit_base"] == "0.00"

    assert client.post(url, json={"action": "reopen"}).status_code == 200
    assert overview(client)["totals"]["receivables_base"] == "100000.00"
    assert overview(client)["totals"]["payables_base"] == "40000.00"


# --- Kasa ---


def test_currency_exchange_between_accounts_books_fx(client, make_event, kasa, euro_kasa):
    event_id = make_event(price="1000", cost="0", currency="EUR", rate="36")
    collect(client, event_id, "1000", currency="EUR", rate="36", cash_account_id=euro_kasa.id)

    response = client.post(
        f"{API}/transfers",
        json={
            "transfer_date": TODAY,
            "from_account_id": euro_kasa.id,
            "to_account_id": kasa.id,
            "from_amount": "500",
            "to_amount": "18500",
        },
    )

    assert response.status_code == 201
    accounts = {a["name"]: a for a in overview(client)["cash_accounts"]}
    assert accounts["Euro Kasa"]["balance"] == "500.00"
    assert accounts["Merkez Kasa"]["balance"] == "18500.00"
    assert finance(client, event_id)["fx_base"] == "0.00"  # bozdurma farkı etkinliğe yazılmaz


# --- Dönem kilidi ve yetki ---


def test_closed_period_rejects_entries(client, make_event, kasa, db):
    event_id = make_event()
    db.add(AccountingPeriod(month=month_key(clock.today()), status=PeriodStatus.CLOSED))
    db.flush()

    response = collect(client, event_id, "1000", cash_account_id=kasa.id)

    assert response.status_code == 400
    assert "dönemi kapalı" in response.json()["error"]["message"]


@pytest.mark.parametrize("role", [Role.PARTNER, Role.VIEWER])
def test_partner_and_viewer_see_finance_but_cannot_record(
    client, make_event, kasa, make_user, login, role
):
    event_id = make_event()
    client.cookies.clear()
    login(make_user(role))

    assert client.get(f"{API}/overview").status_code == 200
    assert collect(client, event_id, "1000", cash_account_id=kasa.id).status_code == 403


def test_accounting_records_and_operation_cannot_see(client, make_event, kasa, make_user, login):
    event_id = make_event()
    client.cookies.clear()
    login(make_user(Role.ACCOUNTING))
    assert collect(client, event_id, "1000", cash_account_id=kasa.id).status_code == 201

    client.cookies.clear()
    login(make_user(Role.OPERATION))
    assert client.get(f"{API}/overview").status_code == 403


def test_customer_statement_has_running_balance(client, make_event, kasa):
    event_id = make_event()
    collect(client, event_id, "40000", cash_account_id=kasa.id)
    customer_id = client.get(f"/api/v1/events/{event_id}").json()["customer"]["id"]

    statement = client.get(f"{API}/customers/{customer_id}/statement").json()

    assert [s["running_base"] for s in statement] == ["100000.00", "60000.00"]


def test_backdated_payment_needs_cash_on_that_date(client, kasa, admin, make_event):
    """Geçmiş tarihli çıkış, o tarihte kasada olmayan parayla yapılamaz."""
    event_id = make_event()
    collect(client, event_id, "10000", cash_account_id=kasa.id)  # para bugün girdi
    yesterday = (clock.today() - timedelta(days=1)).isoformat()

    response = client.post(
        f"{API}/expenses",
        json={
            "expense_date": yesterday,
            "category": "rent",
            "title": "Kira",
            "amount": "5000",
            "currency": "TRY",
            "paid_by": "company",
            "cash_account_id": kasa.id,
        },
    )

    assert response.status_code == 400
    assert "yeterli bakiye" in response.json()["error"]["message"]


def test_artist_statement_shows_what_we_owe(client, make_event, kasa):
    """Sanatçı carisi: anlaşmada borçlanma, ödemeyle azalma; bakiye = kalan borcumuz."""
    event_id = make_event(price="100000", cost="40000")
    collect(client, event_id, "100000", cash_account_id=kasa.id)
    payable = finance(client, event_id)["payables"][0]
    client.post(
        f"{API}/payables/{payable['id']}/payments",
        json={
            "payment_date": TODAY,
            "currency": "TRY",
            "cash_account_id": kasa.id,
            "amount": "15000",
        },
    )

    rows = client.get(f"{API}/artists/{payable['payee']['id']}/statement").json()

    assert [(r["credit"], r["debit"]) for r in rows] == [("40000.00", "0.00"), ("0.00", "15000.00")]
    assert [r["running_base"] for r in rows] == ["40000.00", "25000.00"]
    assert client.get(f"{API}/artists/999999/statement").status_code == 404
    assert client.get(f"{API}/suppliers/999999/statement").status_code == 404
