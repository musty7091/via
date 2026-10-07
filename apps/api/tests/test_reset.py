# ruff: noqa: F811  (pytest fixture parametreleri içe aktarılan fixture adlarını kullanır)
"""Deneme verisini silme: neyin silindiği, neyin korunduğu ve numaraların baştan başlaması."""

import pytest
from sqlalchemy import func, select

from app.cli import reset_data_command
from app.core.permissions import Role
from app.db.models import Base
from app.maintenance.reset import ALWAYS_KEPT, OPTIONAL_GROUPS, TRANSACTIONS, reset_data
from app.modules.catalog.models import Artist
from app.modules.finance.reports import trial_balance
from app.modules.users.models import User
from tests.test_cancel_and_dates import cancel, collect
from tests.test_closing import (  # noqa: F401  (fixture'lar)
    TODAY,
    C,
    F,
    admin,
    event_factory,
    kasa,
    ledger_ok,
    partners,
)


def count(db, table: str) -> int:
    return db.scalar(select(func.count()).select_from(Base.metadata.tables[table]))


def test_every_table_belongs_to_exactly_one_group():
    groups = [TRANSACTIONS, ALWAYS_KEPT, *OPTIONAL_GROUPS.values()]
    seen: dict[str, int] = {}
    for group in groups:
        for name in group:
            seen[name] = seen.get(name, 0) + 1
    assert set(seen) == set(Base.metadata.tables), (
        "Yeni tablo sıfırlama gruplarına eklenmeli (app/maintenance/reset.py)"
    )
    assert all(n == 1 for n in seen.values())


@pytest.fixture
def busy_company(client, db, admin, partners, event_factory, kasa):
    """Denenmiş bir sistem: kullanıcı, ortak, katalog, müşteri, iki etkinlik, para hareketleri."""
    client.patch("/api/v1/settings/company", json={"tax_number": "MŞ-1"})
    client.post(
        "/api/v1/users",
        json={
            "full_name": "Deneme Muhasebe",
            "email": "deneme@test.com",
            "role": "accounting",
            "password": "Deneme-Sifre-2026",
        },
    )
    first = event_factory()
    collect(client, first, kasa, "30000")
    second = event_factory()
    collect(client, second, kasa, "5000")
    cancel(client, second)
    artist = db.scalar(select(Artist))
    artist.manager_partner_id = partners[0].id
    db.flush()
    assert count(db, "journal_entries") > 0
    return first


def test_reset_keeping_catalog_and_customers(client, db, admin, busy_company):
    reset_data(db, keep={"catalog", "customers"})

    for table in TRANSACTIONS - {"audit_logs"}:
        assert count(db, table) == 0, table
    assert count(db, "audit_logs") == 1  # sadece sıfırlama kaydı
    assert count(db, "artists") > 0
    assert count(db, "customers") > 0
    assert count(db, "cash_accounts") == 0
    assert count(db, "partners") == 0
    assert [u.role for u in db.scalars(select(User))] == [Role.SUPER_ADMIN]
    assert db.scalar(select(Artist)).manager_partner_id is None
    assert trial_balance(db) == 0
    assert client.get("/api/v1/settings/company").json()["tax_number"] == "MŞ-1"


def test_numbers_restart_after_reset(client, db, admin, partners, busy_company, event_factory):
    reset_data(db, keep={"people"})  # yeni teklif için ortak gerekir
    event_id = event_factory()
    assert client.get(f"/api/v1/events/{event_id}").json()["event_no"].endswith("-0001")


def test_reset_keeping_everything_optional(client, db, admin, busy_company):
    users_before = count(db, "users")

    reset_data(db, keep=set(OPTIONAL_GROUPS))

    assert count(db, "users") == users_before
    assert count(db, "partners") == 3
    assert count(db, "cash_accounts") == 1
    accounts = client.get(f"{F}/overview").json()["cash_accounts"]
    assert [a["balance"] for a in accounts] == ["0.00"]  # bakiye hareketlerden gelir
    assert count(db, "events") == 0
    assert client.get(f"{C}/periods").status_code == 200


def test_cli_requires_confirmation():
    with pytest.raises(SystemExit) as exit_info:
        reset_data_command([], confirm=None)
    assert "SIFIRLA" in str(exit_info.value)


def test_unknown_group_is_rejected(db):
    with pytest.raises(ValueError):
        reset_data(db, keep={"everything"})
