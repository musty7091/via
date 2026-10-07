# ruff: noqa: F811  (pytest fixture parametreleri içe aktarılan fixture adlarını kullanır)
"""Etkinlik iptali (kapora), kârın etkinlik ayına yazılması ve iptal ters kaydının tarihi."""

from datetime import timedelta

from sqlalchemy import select

from app.modules.finance.models import EntryKind, JournalEntry
from tests.test_closing import (  # noqa: F401  (fixture'lar)
    LAST_MONTH,
    LAST_MONTH_DAY,
    THIS_MONTH,
    TODAY,
    C,
    F,
    admin,
    complete,
    event_factory,
    kasa,
    ledger_ok,
    partners,
)


def collect(client, event_id, kasa, amount, day=TODAY):
    r = client.post(
        f"{F}/collections",
        json={
            "event_id": event_id,
            "collection_date": day.isoformat(),
            "amount": amount,
            "currency": "TRY",
            "cash_account_id": kasa.id,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def cancel(client, event_id, **refund):
    return client.post(
        f"/api/v1/events/{event_id}/status",
        json={"action": "cancel", "note": "Müşteri vazgeçti", **refund},
    )


def fin(client, event_id):
    return client.get(f"{F}/events/{event_id}").json()


def cash(client, name="Kasa"):
    return {a["name"]: a for a in client.get(f"{F}/overview").json()["cash_accounts"]}[name][
        "balance"
    ]


def last_entry(db, kind):
    return db.scalars(
        select(JournalEntry).where(JournalEntry.kind == kind).order_by(JournalEntry.id.desc())
    ).first()


# --- Kapora: iptal edilen etkinlikte alınan para şirkette kalır ---


def test_cancel_keeps_deposit_as_revenue_and_cancels_unpaid_costs(client, event_factory, kasa):
    event_id = event_factory(price="100000", cost="40000")
    collect(client, event_id, kasa, "10000")

    assert cancel(client, event_id).status_code == 200

    f = fin(client, event_id)
    assert f["cancel_kept_amount"] == "10000.00"
    assert f["cancel_refunded_amount"] == "0.00"
    assert f["revenue_base"] == "10000.00"
    assert f["cost_base"] == "0.00"
    assert f["profit_base"] == "10000.00"
    assert f["receivable_base"] == "0.00"
    assert cash(client) == "10000.00"
    totals = client.get(f"{F}/overview").json()["totals"]
    assert totals["payables_base"] == "0.00"


def test_cancelled_event_with_kept_deposit_is_closed_and_shared(client, event_factory, kasa):
    event_id = event_factory(price="100000", cost="40000")
    collect(client, event_id, kasa, "9000")
    cancel(client, event_id)

    preview = client.get(f"{C}/events/{event_id}").json()
    assert preview["can_close"] is True, preview["checks"]
    closed = client.post(f"{C}/events/{event_id}/close", json={})
    assert closed.status_code == 200, closed.text
    assert [s["share"] for s in closed.json()["shares"]] == ["3000.00", "3000.00", "3000.00"]


def test_exceptional_full_refund_leaves_nothing(client, event_factory, kasa):
    event_id = event_factory()
    collect(client, event_id, kasa, "10000")

    r = cancel(client, event_id, refund_amount="10000", refund_cash_account_id=kasa.id)

    assert r.status_code == 200, r.text
    f = fin(client, event_id)
    assert f["cancel_refunded_amount"] == "10000.00"
    assert f["cancel_kept_amount"] == "0.00"
    assert f["profit_base"] == "0.00"
    assert cash(client) == "0.00"
    # Sonucu sıfır olan iptal etkinlik dönem kapanışını engellemez
    assert client.get(f"{C}/events/{event_id}").json()["profit"] == "0.00"


def test_partial_refund_keeps_the_rest(client, event_factory, kasa):
    event_id = event_factory()
    collect(client, event_id, kasa, "10000")

    cancel(client, event_id, refund_amount="4000", refund_cash_account_id=kasa.id)

    f = fin(client, event_id)
    assert f["cancel_refunded_amount"] == "4000.00"
    assert f["cancel_kept_amount"] == "6000.00"
    assert f["profit_base"] == "6000.00"
    assert cash(client) == "6000.00"


def test_refund_cannot_exceed_collected(client, event_factory, kasa):
    event_id = event_factory()
    collect(client, event_id, kasa, "10000")
    r = cancel(client, event_id, refund_amount="12000", refund_cash_account_id=kasa.id)
    assert r.status_code == 400
    assert "fazla olamaz" in r.json()["error"]["message"]


def test_paid_cost_stays_unpaid_part_is_released(client, event_factory, kasa):
    event_id = event_factory(price="100000", cost="40000")
    collect(client, event_id, kasa, "20000")
    payable = fin(client, event_id)["payables"][0]
    paid = client.post(
        f"{F}/payables/{payable['id']}/payments",
        json={
            "payment_date": TODAY.isoformat(),
            "amount": "15000",
            "currency": "TRY",
            "cash_account_id": kasa.id,
        },
    )
    assert paid.status_code in (200, 201), paid.text

    cancel(client, event_id)

    f = fin(client, event_id)
    assert f["revenue_base"] == "20000.00"
    assert f["cost_base"] == "15000.00"
    assert f["profit_base"] == "5000.00"
    assert f["payables"][0]["amount"] == "15000.00"
    assert client.get(f"{F}/overview").json()["totals"]["payables_base"] == "0.00"


def test_reopen_after_cancel_restores_everything(client, event_factory, kasa):
    event_id = event_factory(price="100000", cost="40000")
    collect(client, event_id, kasa, "20000")
    payable = fin(client, event_id)["payables"][0]
    client.post(
        f"{F}/payables/{payable['id']}/payments",
        json={
            "payment_date": TODAY.isoformat(),
            "amount": "15000",
            "currency": "TRY",
            "cash_account_id": kasa.id,
        },
    )
    cancel(client, event_id, refund_amount="5000", refund_cash_account_id=kasa.id)
    assert cash(client) == "0.00"

    r = client.post(f"/api/v1/events/{event_id}/status", json={"action": "reopen"})

    assert r.status_code == 200, r.text
    f = fin(client, event_id)
    assert f["remaining_amount"] == "80000.00"
    assert f["revenue_base"] == "100000.00"
    assert f["cost_base"] == "40000.00"
    assert [p["amount"] for p in f["payables"] if p["status"] == "active"] == ["40000.00"]
    assert cash(client) == "5000.00"  # iade geri alındı
    assert f["cancel_kept_amount"] == "0.00"


def test_cancelled_event_money_cannot_be_cancelled(client, event_factory, kasa):
    event_id = event_factory()
    collection = collect(client, event_id, kasa, "10000")
    cancel(client, event_id)
    r = client.post(f"{F}/collections/{collection['id']}/cancel", json={"reason": "Hata"})
    assert r.status_code == 400
    assert "yeniden açın" in r.json()["error"]["message"]


# --- Kâr etkinliğin yapıldığı aya yazılır ---


def _past_event(client, event_factory, kasa, day=LAST_MONTH_DAY):
    event_id = event_factory(price="90000", cost="30000")
    r = client.patch(f"/api/v1/events/{event_id}", json={"event_date": day.isoformat()})
    assert r.status_code == 200, r.text
    complete(client, event_id)
    collect(client, event_id, kasa, "90000", day=day)
    return event_id


def test_profit_is_dated_on_event_day(client, db, event_factory, kasa):
    event_id = _past_event(client, event_factory, kasa)

    assert client.post(f"{C}/events/{event_id}/close", json={}).status_code == 200

    entry = last_entry(db, EntryKind.EVENT_CLOSE)
    assert entry.entry_date == LAST_MONTH_DAY
    last = client.get(f"{C}/periods/{LAST_MONTH}").json()
    assert last["closed_events_profit"] == "60000.00"
    assert client.get(f"{C}/periods/{THIS_MONTH}").json()["closed_events_profit"] == "0.00"


def test_period_cannot_close_with_unclosed_event(client, event_factory, kasa):
    event_id = _past_event(client, event_factory, kasa)
    event_no = client.get(f"/api/v1/events/{event_id}").json()["event_no"]

    blocked = client.post(f"{C}/periods/{LAST_MONTH}/close")

    assert blocked.status_code == 400
    assert event_no in blocked.json()["error"]["message"]
    client.post(f"{C}/events/{event_id}/close", json={})
    assert client.post(f"{C}/periods/{LAST_MONTH}/close").status_code == 200
    # Kapanmış ayın etkinliğinin kapanışı geri alınamaz
    reopen = client.post(f"{C}/events/{event_id}/reopen", json={"reason": "Kontrol"})
    assert reopen.status_code == 400
    assert "yeniden açın" in reopen.json()["error"]["message"]


# --- İptal ters kaydı: dönem açıksa orijinal tarihe ---


def test_reversal_goes_to_original_date_when_period_open(client, db, event_factory, kasa):
    event_id = event_factory()
    day = LAST_MONTH_DAY - timedelta(days=3)
    collection = collect(client, event_id, kasa, "10000", day=day)

    client.post(f"{F}/collections/{collection['id']}/cancel", json={"reason": "Yanlış"})

    assert last_entry(db, EntryKind.REVERSAL).entry_date == day


def test_reversal_goes_to_today_when_period_closed(client, db, admin, partners, kasa):
    day = LAST_MONTH_DAY - timedelta(days=3)
    expense = client.post(
        f"{F}/expenses",
        json={
            "expense_date": day.isoformat(),
            "title": "Kira",
            "category": "rent",
            "amount": "1000",
            "currency": "TRY",
            "paid_by": "unpaid",
        },
    )
    assert expense.status_code == 201, expense.text
    assert client.post(f"{C}/periods/{LAST_MONTH}/close").status_code == 200

    r = client.post(f"{F}/expenses/{expense.json()['id']}/cancel", json={"reason": "Hata"})

    assert r.status_code == 200, r.text
    assert last_entry(db, EntryKind.REVERSAL).entry_date == TODAY


def test_backdated_reversal_cannot_make_cash_negative_on_any_day(client, event_factory, kasa):
    event_id = event_factory()
    first = LAST_MONTH_DAY - timedelta(days=10)
    collection = collect(client, event_id, kasa, "10000", day=first)
    spent = client.post(
        f"{F}/expenses",
        json={
            "expense_date": (first + timedelta(days=5)).isoformat(),
            "title": "Ses",
            "category": "other",
            "amount": "8000",
            "currency": "TRY",
            "paid_by": "company",
            "cash_account_id": kasa.id,
        },
    )
    assert spent.status_code == 201, spent.text
    collect(client, event_id, kasa, "9000")  # bugün bakiye 11.000: bugüne bakan kontrol yetmez

    r = client.post(f"{F}/collections/{collection['id']}/cancel", json={"reason": "Hata"})

    assert r.status_code == 400
    assert "yeterli bakiye" in r.json()["error"]["message"]
