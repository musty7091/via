"""Deneme verisini silme (müşteri denedikten sonra temiz başlangıç).

Her tablo tam olarak bir gruba aittir (testi bunu denetler; yeni tablo eklenince buraya
eklenmesi zorunludur):
- TRANSACTIONS her zaman silinir: teklif, etkinlik, finans, operasyon, kapanış, işlem geçmişi,
  belge numaraları. Numaralar baştan başlar.
- İsteğe bağlı gruplar korunabilir: katalog, müşteriler, kasa/banka hesapları, kişiler.
- ALWAYS_KEPT hiç silinmez: firma ayarları, kur geçmişi. Süper admin kullanıcıları da kalır.

Korunan bir tablo silinen bir tabloya bağlıysa bağ boşaltılır (ör. sanatçının menajer ortağı).
Boşaltılamayan (zorunlu) bir bağ varsa işlem hiç başlamadan durur. Her şey tek transaction'dır:
bir adım hata verirse hiçbir şey silinmez.
"""

from collections.abc import Iterable
from dataclasses import dataclass

from sqlalchemy import Table, delete, select, text, update
from sqlalchemy.orm import Session

from app.core.permissions import Role
from app.db.models import Base
from app.modules.audit import service as audit
from app.modules.users.models import User

TRANSACTIONS = frozenset(
    {
        "offers",
        "offer_lines",
        "events",
        "event_items",
        "event_tasks",
        "operation_reports",
        "rider_checks",
        "payment_plans",
        "journal_entries",
        "journal_lines",
        "collections",
        "payables",
        "payable_payments",
        "expenses",
        "partner_transactions",
        "cash_transfers",
        "receivable_write_offs",
        "event_closures",
        "accounting_periods",
        "audit_logs",
        "document_sequences",
    }
)

OPTIONAL_GROUPS: dict[str, frozenset[str]] = {
    "catalog": frozenset(
        {"artists", "artist_rider_items", "service_items", "suppliers", "packages", "package_items"}
    ),
    "customers": frozenset({"customers", "customer_contacts", "venues"}),
    "cash_accounts": frozenset({"cash_accounts"}),
    # Kişiler: ortaklar ve süper admin dışındaki kullanıcılar (users tablosu satır satır silinir).
    "people": frozenset({"partners", "users"}),
}

GROUP_LABELS = {
    "catalog": "katalog (sanatçı, hizmet, tedarikçi, paket)",
    "customers": "müşteriler ve mekânlar",
    "cash_accounts": "kasa/banka hesapları",
    "people": "ortaklar ve diğer kullanıcılar",
}

ALWAYS_KEPT = frozenset({"company_settings", "exchange_rates"})


@dataclass(frozen=True)
class ResetResult:
    kept: tuple[str, ...]
    wiped_tables: tuple[str, ...]
    deleted_users: int


def _tables() -> dict[str, Table]:
    return {t.name: t for t in Base.metadata.sorted_tables}


def _clear_links(
    db: Session, kept: Iterable[str], targets: set[str], where_ids: list[int] | None = None
) -> None:
    """Korunan tablolardaki, silinecek tablolara giden bağları boşaltır."""
    tables = _tables()
    for name in kept:
        table = tables[name]
        for fk in table.foreign_keys:
            if fk.column.table.name not in targets:
                continue
            if not fk.parent.nullable:
                raise RuntimeError(
                    f"{name}.{fk.parent.name} zorunlu olarak {fk.column.table.name} "
                    "tablosuna bağlı; bu tablo korunurken o grup silinemez."
                )
            stmt = update(table).values({fk.parent.name: None})
            if where_ids is not None:
                stmt = stmt.where(fk.parent.in_(where_ids))
            db.execute(stmt)


def reset_data(db: Session, keep: Iterable[str]) -> ResetResult:
    keep = frozenset(keep)
    unknown = keep - OPTIONAL_GROUPS.keys()
    if unknown:
        raise ValueError(f"Bilinmeyen grup: {', '.join(sorted(unknown))}")

    wiped = set(TRANSACTIONS)
    for group, tables in OPTIONAL_GROUPS.items():
        if group not in keep:
            wiped |= tables
    truncated = wiped - {"users"}  # kullanıcılar satır satır silinir (süper admin kalır)
    kept_tables = [name for name in _tables() if name not in wiped or name == "users"]

    _clear_links(db, kept_tables, truncated)
    user_ids: list[int] = []
    if "people" not in keep:
        user_ids = list(db.scalars(select(User.id).where(User.role != Role.SUPER_ADMIN)))
        others = [name for name in kept_tables if name != "users"]
        _clear_links(db, others, {"users"}, where_ids=user_ids)

    # Silinmeyen bir tablonun bağ verdiği tablo TRUNCATE edilemez (PostgreSQL bağın kendisine
    # bakar); bunlar satır satır silinir. Kısıtlamalar korunur (CASCADE yok): unutulmuş bir bağ
    # varsa PostgreSQL işlemi reddeder ve hiçbir şey silinmez.
    tables = _tables()
    row_deleted: set[str] = set()
    while True:
        bulk = truncated - row_deleted
        referenced = {
            fk.column.table.name
            for name, table in tables.items()
            if name not in bulk
            for fk in table.foreign_keys
            if fk.column.table.name in bulk
        }
        if not referenced:
            break
        row_deleted |= referenced
    if bulk:
        db.execute(text(f"TRUNCATE {', '.join(sorted(bulk))} RESTART IDENTITY"))
    for table in reversed(Base.metadata.sorted_tables):
        if table.name in row_deleted:
            db.execute(delete(table))
            for column in table.primary_key.columns:
                db.execute(
                    text("SELECT setval(pg_get_serial_sequence(:t, :c), 1, false)"),
                    {"t": table.name, "c": column.name},
                )
    if user_ids:
        db.execute(delete(User).where(User.id.in_(user_ids)))

    kept_labels = tuple(GROUP_LABELS[g] for g in OPTIONAL_GROUPS if g in keep)
    audit.record(
        db,
        actor=None,
        action="system.reset",
        entity_type="system",
        entity_id=None,
        summary="Deneme verisi silindi. Korunanlar: süper admin, firma ayarları"
        + "".join(f", {label}" for label in kept_labels)
        + ".",
        context=None,
    )
    db.commit()
    return ResetResult(
        kept=kept_labels, wiped_tables=tuple(sorted(wiped)), deleted_users=len(user_ids)
    )
