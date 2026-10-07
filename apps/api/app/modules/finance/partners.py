"""Ortak hesapları: ortak üzerindeki para ve şirketin ortağa borcu.

- Teslim (handover): ortak elindeki şirket parasını kasaya teslim eder.
- Ödeme (payout): şirket ortağa olan borcunu öder (ör. ortağın cebinden ödediği gider).
- Mahsup (offset): ortağın elindeki para ile şirketin ona borcu karşılıklı kapatılır.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.deps import RequestContext
from app.core.errors import DomainError, NotFoundError
from app.core.money import ZERO, Currency, format_money, money
from app.modules.audit import service as audit
from app.modules.finance import common, ledger
from app.modules.finance.ledger import Leg
from app.modules.finance.models import (
    Account,
    DocStatus,
    EntryKind,
    JournalEntry,
    JournalLine,
    PartnerTransaction,
    PartnerTxKind,
)
from app.modules.partners.models import Partner
from app.modules.users.models import User

KIND_LABELS = {
    PartnerTxKind.HANDOVER: "Kasaya teslim",
    PartnerTxKind.PAYOUT: "Ortağa ödeme",
    PartnerTxKind.OFFSET: "Mahsup",
}


def partner_position(db: Session, partner_id: int) -> dict[str, dict[str, Decimal]]:
    """Ortağın para birimine göre durumu:
    held = ortak üzerindeki şirket parası, owed = şirketin ortağa borcu."""
    held = ledger.amount_balance(db, Account.PARTNER_CASH, partner_id=partner_id)
    owed = {
        c: -a
        for c, a in ledger.amount_balance(
            db, Account.PARTNER_PAYABLE, partner_id=partner_id
        ).items()
    }
    return {"held": held, "owed": owed}


def create_transaction(
    db: Session,
    *,
    kind: PartnerTxKind,
    partner_id: int,
    tx_date: date,
    amount: Decimal,
    currency: Currency,
    cash_account_id: int | None,
    note: str | None,
    actor: User,
    context: RequestContext,
) -> PartnerTransaction:
    partner = common.get_partner(db, partner_id)
    if amount <= 0:
        raise DomainError("Tutar sıfırdan büyük olmalıdır.")
    common.check_date(tx_date)
    amount = money(amount)
    held_amount, held_base = common.carrying(
        db, Account.PARTNER_CASH, currency, partner_id=partner.id
    )
    owed_amount, owed_base = common.carrying(
        db, Account.PARTNER_PAYABLE, currency, partner_id=partner.id
    )
    owed_amount, owed_base = -owed_amount, -owed_base

    account = None
    if kind in {PartnerTxKind.HANDOVER, PartnerTxKind.PAYOUT}:
        if cash_account_id is None:
            raise DomainError("Kasa/banka hesabını seçin.")
        account = common.get_cash_account(db, cash_account_id, currency)

    if kind == PartnerTxKind.HANDOVER:
        if amount > held_amount:
            raise DomainError(
                f"{partner.full_name} üzerinde {format_money(held_amount, currency)} "
                "şirket parası var; "
                "fazlası teslim alınamaz."
            )
        base = common.proportional_base(held_amount, held_base, amount)
        rate = common.implied_rate(base, amount)
        legs = [
            Leg(Account.CASH, base, amount, currency, rate, cash_account_id=account.id),  # type: ignore[union-attr]
            Leg(Account.PARTNER_CASH, -base, -amount, currency, rate, partner_id=partner.id),
        ]
        description = f"{partner.full_name} elindeki parayı {account.name} hesabına teslim etti"  # type: ignore[union-attr]
    elif kind == PartnerTxKind.PAYOUT:
        if amount > owed_amount:
            raise DomainError(
                f"Şirketin {partner.full_name}'a borcu {format_money(owed_amount, currency)}; "
                "fazlası ödenemez."
            )
        common.assert_cash_available(db, account, amount, tx_date)  # type: ignore[arg-type]
        base = common.proportional_base(owed_amount, owed_base, amount)
        rate = common.implied_rate(base, amount)
        legs = [
            Leg(Account.PARTNER_PAYABLE, base, amount, currency, rate, partner_id=partner.id),
            Leg(Account.CASH, -base, -amount, currency, rate, cash_account_id=account.id),  # type: ignore[union-attr]
        ]
        description = f"{partner.full_name}'a ödeme ({account.name})"  # type: ignore[union-attr]
    else:
        limit = min(held_amount, owed_amount)
        if amount > limit:
            raise DomainError(
                f"Mahsup edilebilecek en fazla tutar {max(limit, ZERO)} {currency} "
                f"(ortak üzerinde {held_amount}, şirketin borcu {owed_amount})."
            )
        payable_base = common.proportional_base(owed_amount, owed_base, amount)
        cash_base = common.proportional_base(held_amount, held_base, amount)
        legs = [
            Leg(
                Account.PARTNER_PAYABLE,
                payable_base,
                amount,
                currency,
                common.implied_rate(payable_base, amount),
                partner_id=partner.id,
            ),
            Leg(
                Account.PARTNER_CASH,
                -cash_base,
                -amount,
                currency,
                common.implied_rate(cash_base, amount),
                partner_id=partner.id,
            ),
        ]
        fx = ledger.balancing_fx_leg(legs)
        if fx:
            legs.append(fx)
        description = f"{partner.full_name} mahsup: elindeki para ile şirketin borcu kapatıldı"

    entry = ledger.post(
        db,
        kind={
            PartnerTxKind.HANDOVER: EntryKind.PARTNER_HANDOVER,
            PartnerTxKind.PAYOUT: EntryKind.PARTNER_PAYOUT,
            PartnerTxKind.OFFSET: EntryKind.PARTNER_OFFSET,
        }[kind],
        entry_date=tx_date,
        description=description,
        legs=legs,
        actor=actor,
    )
    tx = PartnerTransaction(
        kind=kind,
        partner_id=partner.id,
        tx_date=tx_date,
        amount=amount,
        currency=currency,
        rate=legs[0].rate,
        cash_account_id=account.id if account else None,
        note=note,
        entry_id=entry.id,
    )
    db.add(tx)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action=f"partner.{kind}",
        entity_type="partner",
        entity_id=partner.id,
        summary=f"{KIND_LABELS[kind]}: {description}, {format_money(amount, currency)}.",
        context=context,
    )
    db.commit()
    db.refresh(tx)
    return tx


def get_transaction(db: Session, tx_id: int) -> PartnerTransaction:
    tx = db.get(PartnerTransaction, tx_id)
    if tx is None:
        raise NotFoundError("Ortak işlemi bulunamadı.")
    return tx


def cancel_transaction(
    db: Session, tx: PartnerTransaction, reason: str, *, actor: User, context: RequestContext
) -> PartnerTransaction:
    if tx.status != DocStatus.ACTIVE:
        raise DomainError("Bu işlem zaten iptal edilmiş.")
    if not reason:
        raise DomainError("İptal sebebini yazın.")
    if tx.kind == PartnerTxKind.HANDOVER:
        common.assert_cash_available(db, tx.cash_account, tx.amount)  # type: ignore[arg-type]
    entry = db.get(JournalEntry, tx.entry_id)
    ledger.reverse(
        db,
        entry,  # type: ignore[arg-type]
        entry_date=clock.today(),
        description=f"İptal: {KIND_LABELS[PartnerTxKind(tx.kind)]}. Sebep: {reason}",
        actor=actor,
    )
    tx.status = DocStatus.CANCELLED
    tx.cancel_reason = reason
    audit.record(
        db,
        actor=actor,
        action="partner.cancel",
        entity_type="partner",
        entity_id=tx.partner_id,
        summary=f"{KIND_LABELS[PartnerTxKind(tx.kind)]} işlemi iptal edildi. Sebep: {reason}",
        context=context,
    )
    db.commit()
    db.refresh(tx)
    return tx


def statement_lines(db: Session, partner: Partner) -> list[JournalLine]:
    return list(
        db.scalars(
            select(JournalLine)
            .join(JournalEntry)
            .where(
                JournalLine.partner_id == partner.id,
                JournalLine.account.in_([Account.PARTNER_CASH, Account.PARTNER_PAYABLE]),
            )
            .order_by(JournalEntry.entry_date, JournalEntry.id, JournalLine.id)
        )
    )
