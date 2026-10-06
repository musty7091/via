"""Rol ve yetki tablosu: kim neyi yapabilir?

Her endpoint bir yetki ister (ör. `require(Permission.USERS_MANAGE)`). Roller sadece
yetki gruplarıdır. Yetkiyi değiştirmek için sadece bu dosya düzenlenir.
"""

from enum import StrEnum


class Role(StrEnum):
    SUPER_ADMIN = "super_admin"
    PARTNER = "partner"
    ACCOUNTING = "accounting"
    OPERATION = "operation"
    VIEWER = "viewer"


ROLE_LABELS: dict[Role, str] = {
    Role.SUPER_ADMIN: "Süper Admin",
    Role.PARTNER: "Ortak",
    Role.ACCOUNTING: "Muhasebe",
    Role.OPERATION: "Operasyon",
    Role.VIEWER: "İzleyici",
}


class Permission(StrEnum):
    USERS_MANAGE = "users.manage"
    SETTINGS_MANAGE = "settings.manage"
    AUDIT_VIEW = "audit.view"

    PARTNERS_VIEW = "partners.view"
    PARTNERS_MANAGE = "partners.manage"

    CUSTOMERS_VIEW = "customers.view"
    CUSTOMERS_MANAGE = "customers.manage"
    CATALOG_VIEW = "catalog.view"
    CATALOG_MANAGE = "catalog.manage"
    OFFERS_VIEW = "offers.view"
    OFFERS_MANAGE = "offers.manage"
    EVENTS_VIEW = "events.view"
    EVENTS_MANAGE = "events.manage"
    OPERATIONS_VIEW = "operations.view"
    OPERATIONS_MANAGE = "operations.manage"

    # İç maliyetleri ve kârlılığı görme (operasyon ekibi görmez)
    COSTS_VIEW = "costs.view"

    FINANCE_VIEW = "finance.view"
    FINANCE_RECORD = "finance.record"
    FINANCE_APPROVE = "finance.approve"
    PERIOD_CLOSE = "period.close"
    PERIOD_REOPEN = "period.reopen"
    REPORTS_VIEW = "reports.view"


_ALL = frozenset(Permission)
_VIEW_ALL = frozenset(
    {
        Permission.PARTNERS_VIEW,
        Permission.CUSTOMERS_VIEW,
        Permission.CATALOG_VIEW,
        Permission.OFFERS_VIEW,
        Permission.EVENTS_VIEW,
        Permission.OPERATIONS_VIEW,
        Permission.COSTS_VIEW,
        Permission.FINANCE_VIEW,
        Permission.REPORTS_VIEW,
    }
)

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    # Sistemin tek sahibi. Ortak değildir; kâr paylaşımına katılmaz.
    # Finans onayı, dönem kapatma, ortak/kullanıcı/ayar yönetimi sadece buradadır.
    Role.SUPER_ADMIN: _ALL,
    # Ortaklar her şeyi görür (şeffaf ortaklık); satış ve katalog işlerini yönetir.
    # Finans kaydı, onay ve kapanış yapamaz.
    Role.PARTNER: _VIEW_ALL
    | {
        Permission.CUSTOMERS_MANAGE,
        Permission.OFFERS_MANAGE,
        Permission.EVENTS_MANAGE,
        Permission.CATALOG_MANAGE,
    },
    # Muhasebe kayıt girer; onay ve dönem kapatma süper admindedir.
    Role.ACCOUNTING: _VIEW_ALL
    | {
        Permission.AUDIT_VIEW,
        Permission.CUSTOMERS_MANAGE,
        Permission.FINANCE_RECORD,
    },
    # Operasyon ekibi etkinliği yürütür; maliyet ve finans görmez.
    Role.OPERATION: frozenset(
        {
            Permission.CUSTOMERS_VIEW,
            Permission.CATALOG_VIEW,
            Permission.EVENTS_VIEW,
            Permission.OPERATIONS_VIEW,
            Permission.OPERATIONS_MANAGE,
        }
    ),
    Role.VIEWER: _VIEW_ALL,
}


def permissions_for(role: Role) -> frozenset[Permission]:
    return ROLE_PERMISSIONS[role]
