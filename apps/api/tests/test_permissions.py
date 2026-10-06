"""Rol tablosunun iş kararlarıyla uyumunu kilitler (5 Ekim 2026 kararı).

Bu testlerden biri kırılırsa rol yetkileri değişmiş demektir; bilinçli bir karar
değilse permissions.py geri alınmalıdır.
"""

import pytest

from app.core.permissions import Permission, Role, permissions_for

ONLY_SUPER_ADMIN = {
    Permission.USERS_MANAGE,
    Permission.SETTINGS_MANAGE,
    Permission.PARTNERS_MANAGE,
    Permission.FINANCE_APPROVE,
    Permission.PERIOD_CLOSE,
    Permission.PERIOD_REOPEN,
}


@pytest.mark.parametrize("permission", sorted(ONLY_SUPER_ADMIN))
def test_critical_permissions_belong_only_to_super_admin(permission):
    holders = {role for role in Role if permission in permissions_for(role)}

    assert holders == {Role.SUPER_ADMIN}


def test_partner_sees_everything_financial():
    partner = permissions_for(Role.PARTNER)

    for permission in (
        Permission.FINANCE_VIEW,
        Permission.COSTS_VIEW,
        Permission.REPORTS_VIEW,
        Permission.PARTNERS_VIEW,
    ):
        assert permission in partner


def test_partner_manages_sales_and_catalog_but_not_finance():
    partner = permissions_for(Role.PARTNER)

    assert {
        Permission.CUSTOMERS_MANAGE,
        Permission.OFFERS_MANAGE,
        Permission.EVENTS_MANAGE,
        Permission.CATALOG_MANAGE,
    } <= partner
    assert Permission.FINANCE_RECORD not in partner


def test_accounting_records_finance_but_cannot_approve():
    accounting = permissions_for(Role.ACCOUNTING)

    assert Permission.FINANCE_RECORD in accounting
    assert Permission.FINANCE_APPROVE not in accounting


def test_operation_never_sees_costs_or_finance():
    operation = permissions_for(Role.OPERATION)

    assert Permission.COSTS_VIEW not in operation
    assert Permission.FINANCE_VIEW not in operation
