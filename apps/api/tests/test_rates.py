"""Döviz kurları: TCMB'den çekme, elle düzeltme, tarihe göre öneri."""

from datetime import timedelta

import pytest

from app.core import clock
from app.core.permissions import Role
from app.modules.rates import service as rates

R = "/api/v1/rates"
TODAY = clock.today()

TCMB_XML = f"""<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="{TODAY:%d.%m.%Y}" Date="{TODAY:%m/%d/%Y}" Bulten_No="2026/187">
  <Currency Kod="USD" CurrencyCode="USD"><Unit>1</Unit>
    <ForexBuying>49.0732</ForexBuying><ForexSelling>49.1616</ForexSelling></Currency>
  <Currency Kod="EUR" CurrencyCode="EUR"><Unit>1</Unit>
    <ForexBuying>54.9767</ForexBuying><ForexSelling>55.0757</ForexSelling></Currency>
  <Currency Kod="GBP" CurrencyCode="GBP"><Unit>1</Unit>
    <ForexBuying>63.1</ForexBuying><ForexSelling>63.4021</ForexSelling></Currency>
  <Currency Kod="JPY" CurrencyCode="JPY"><Unit>100</Unit>
    <ForexBuying>33.1</ForexBuying><ForexSelling>33.3</ForexSelling></Currency>
</Tarih_Date>""".encode()


@pytest.fixture
def admin(make_user, login):
    user = make_user()
    login(user)
    return user


@pytest.fixture
def tcmb_online(monkeypatch):
    calls = {"n": 0}

    def download() -> bytes:
        calls["n"] += 1
        return TCMB_XML

    monkeypatch.setattr(rates, "_download", download)
    return calls


def by_currency(items):
    return {r["currency"]: r for r in items}


def test_today_rates_are_fetched_from_tcmb_once(client, admin, tcmb_online):
    first = by_currency(client.get(R).json())
    client.get(R)

    assert first["EUR"]["rate"] == "55.075700"
    assert first["USD"]["source"] == "tcmb"
    assert set(first) == {"EUR", "USD", "GBP"}  # sadece kullandığımız dövizler
    assert tcmb_online["n"] == 1


def test_rates_work_offline_and_return_latest_known(client, admin):
    client.put(
        R, json={"day": (TODAY - timedelta(days=3)).isoformat(), "currency": "EUR", "rate": "54"}
    )

    rows = by_currency(client.get(R).json())

    assert rows["EUR"]["rate"] == "54.000000"
    assert rows["EUR"]["day"] == (TODAY - timedelta(days=3)).isoformat()


def test_historical_date_uses_rate_on_or_before(client, admin):
    client.put(
        R, json={"day": (TODAY - timedelta(days=10)).isoformat(), "currency": "USD", "rate": "40"}
    )
    client.put(
        R, json={"day": (TODAY - timedelta(days=2)).isoformat(), "currency": "USD", "rate": "48"}
    )

    rows = by_currency(client.get(R, params={"on": (TODAY - timedelta(days=5)).isoformat()}).json())

    assert rows["USD"]["rate"] == "40.000000"


def test_manual_rate_is_not_overwritten_by_tcmb(client, admin, tcmb_online):
    client.put(R, json={"day": TODAY.isoformat(), "currency": "EUR", "rate": "56.5"})
    client.post(f"{R}/fetch")

    rows = by_currency(client.get(R).json())

    assert rows["EUR"]["rate"] == "56.500000"
    assert rows["EUR"]["source"] == "manual"
    assert rows["USD"]["source"] == "tcmb"


def test_fetch_failure_gives_friendly_error(client, admin):
    r = client.post(f"{R}/fetch")
    assert r.status_code == 400
    assert "elle" in r.json()["error"]["message"]


def test_invalid_manual_rates_are_rejected(client, admin):
    future = (TODAY + timedelta(days=1)).isoformat()
    assert client.put(R, json={"day": future, "currency": "EUR", "rate": "55"}).status_code == 400
    assert (
        client.put(R, json={"day": TODAY.isoformat(), "currency": "TRY", "rate": "1"}).status_code
        == 400
    )
    assert (
        client.put(R, json={"day": TODAY.isoformat(), "currency": "EUR", "rate": "0"}).status_code
        == 400
    )


def test_who_can_edit_rates(client, make_user, login):
    for role, allowed in [
        (Role.PARTNER, True),
        (Role.ACCOUNTING, True),
        (Role.OPERATION, False),
        (Role.VIEWER, False),
    ]:
        login(make_user(role))
        assert client.get(R).status_code == 200
        r = client.put(R, json={"day": TODAY.isoformat(), "currency": "GBP", "rate": "63"})
        assert (r.status_code == 200) is allowed, role
