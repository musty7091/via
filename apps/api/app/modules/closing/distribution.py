"""Kâr/zarar dağıtımı: tutar aktif ortaklar arasında eşit bölünür (kuruş kaybolmaz).

Kâr, ortağın hesabına "şirketin ortağa borcu" olarak yazılır; zarar aynı hesaba
eksi olarak yazılır ve sonraki kârlardan düşülür.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.errors import DomainError
from app.core.money import money, split_evenly
from app.modules.finance import ledger
from app.modules.finance.models import Account, EntryKind, JournalEntry
from app.modules.partners import service as partner_service
from app.modules.users.models import User


def shares_for(db: Session, amount: Decimal) -> list[dict]:
    partners = partner_service.active_partners(db)
    if not partners:
        raise DomainError("Kâr dağıtımı için en az bir aktif ortak olmalıdır.")
    return [
        {"partner_id": p.id, "name": p.full_name, "share": str(share)}
        for p, share in zip(partners, split_evenly(money(amount), len(partners)), strict=True)
    ]


def preview_shares(db: Session, amount: Decimal) -> list[dict]:
    """Önizleme için paylar; henüz ortak tanımlı değilse boş liste (ekran hata vermez,
    kapanış ise shares_for ile engellenir)."""
    if not partner_service.active_partners(db):
        return []
    return shares_for(db, amount)


def post_distribution(
    db: Session,
    *,
    amount: Decimal,
    kind: EntryKind,
    entry_date: date,
    description: str,
    actor: User | None,
    event_id: int | None = None,
) -> tuple[JournalEntry | None, list[dict]]:
    """+ tutar kârdır (ortaklara alacak), − tutar zarardır (ortaklardan düşülür)."""
    shares = shares_for(db, amount)
    if money(amount) == 0:
        return None, shares
    legs = [
        ledger.base_leg(Account.PROFIT_DISTRIBUTED, amount, event_id=event_id, memo=description)
    ]
    legs += [
        ledger.base_leg(
            Account.PARTNER_PAYABLE,
            -Decimal(s["share"]),
            partner_id=s["partner_id"],
            event_id=event_id,
            memo="Kâr payı" if amount > 0 else "Zarar payı",
        )
        for s in shares
        if Decimal(s["share"]) != 0
    ]
    entry = ledger.post(
        db,
        kind=kind,
        entry_date=entry_date,
        description=description,
        legs=legs,
        actor=actor,
        event_id=event_id,
    )
    return entry, shares
