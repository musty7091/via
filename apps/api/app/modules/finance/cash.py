"""Kasa ve banka hesapları, hesaplar arası transfer."""

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core import clock
from app.core.deps import RequestContext
from app.core.errors import DomainError, NotFoundError
from app.core.money import BASE_CURRENCY, format_money, money
from app.modules.audit import service as audit
from app.modules.finance import common, ledger
from app.modules.finance.ledger import Leg
from app.modules.finance.models import (
    Account,
    CashAccount,
    CashAccountType,
    CashTransfer,
    DocStatus,
    EntryKind,
    JournalEntry,
)
from app.modules.users.models import User


def get_account(db: Session, account_id: int) -> CashAccount:
    account = db.get(CashAccount, account_id)
    if account is None:
        raise NotFoundError("Kasa/banka hesabı bulunamadı.")
    return account


def account_balance(db: Session, account: CashAccount) -> tuple[Decimal, Decimal]:
    return common.carrying(db, Account.CASH, account.currency, cash_account_id=account.id)


def create_account(
    db: Session,
    *,
    name: str,
    account_type: CashAccountType,
    currency: str,
    iban: str | None,
    actor: User,
    context: RequestContext,
) -> CashAccount:
    account = CashAccount(name=name, account_type=account_type, currency=currency, iban=iban)
    db.add(account)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="cash_account.create",
        entity_type="cash_account",
        entity_id=account.id,
        summary=f"{name} ({currency}) hesabı açıldı.",
        context=context,
    )
    db.commit()
    db.refresh(account)
    return account


def update_account(
    db: Session, account: CashAccount, changes: dict, *, actor: User, context: RequestContext
) -> CashAccount:
    if changes.get("is_active") is False:
        amount, _ = account_balance(db, account)
        if amount != 0:
            raise DomainError("Bakiyesi olan hesap pasife alınamaz; önce bakiyeyi transfer edin.")
    diff = audit.apply_changes(account, changes, ["name", "iban", "is_active", "sort_order"])
    audit.record(
        db,
        actor=actor,
        action="cash_account.update",
        entity_type="cash_account",
        entity_id=account.id,
        summary=f"{account.name} hesabı güncellendi.",
        changes=diff,
        context=context,
    )
    db.commit()
    db.refresh(account)
    return account


def transfer(
    db: Session,
    *,
    transfer_date: date,
    from_account_id: int,
    to_account_id: int,
    from_amount: Decimal,
    to_amount: Decimal | None,
    note: str | None,
    actor: User,
    context: RequestContext,
) -> CashTransfer:
    if from_account_id == to_account_id:
        raise DomainError("Aynı hesaba transfer yapılamaz.")
    if from_amount <= 0:
        raise DomainError("Tutar sıfırdan büyük olmalıdır.")
    common.check_date(transfer_date)
    source = common.get_cash_account(db, from_account_id)
    target = common.get_cash_account(db, to_account_id)
    from_amount = money(from_amount)
    if source.currency == target.currency:
        to_amount = from_amount
    elif to_amount is None or to_amount <= 0:
        raise DomainError(
            f"{source.currency} → {target.currency} bozdurmada "
            f"hesaba giren {target.currency} tutarını girin."
        )
    to_amount = money(to_amount)
    common.assert_cash_available(db, source, from_amount, transfer_date)

    held_amount, held_base = account_balance(db, source)
    from_base = common.proportional_base(held_amount, held_base, from_amount)
    # TL hesaba giren tutar TL'dir; döviz hesaba girende TL karşılığı çıkan tutarla aynıdır.
    to_base = to_amount if target.currency == BASE_CURRENCY else from_base
    legs = [
        Leg(
            Account.CASH,
            to_base,
            to_amount,
            target.currency,
            common.implied_rate(to_base, to_amount),
            cash_account_id=target.id,
        ),
        Leg(
            Account.CASH,
            -from_base,
            -from_amount,
            source.currency,
            common.implied_rate(from_base, from_amount),
            cash_account_id=source.id,
        ),
    ]
    fx = ledger.balancing_fx_leg(legs)
    if fx:
        legs.append(fx)
    entry = ledger.post(
        db,
        kind=EntryKind.CASH_TRANSFER,
        entry_date=transfer_date,
        description=f"Transfer: {source.name} → {target.name}",
        legs=legs,
        actor=actor,
    )
    tx = CashTransfer(
        transfer_date=transfer_date,
        from_account_id=source.id,
        to_account_id=target.id,
        from_amount=from_amount,
        from_rate=legs[1].rate,
        to_amount=to_amount,
        to_rate=legs[0].rate,
        note=note,
        entry_id=entry.id,
    )
    db.add(tx)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="cash.transfer",
        entity_type="cash_account",
        entity_id=source.id,
        summary=(
            f"Transfer: {format_money(from_amount, source.currency)} {source.name} → "
            f"{format_money(to_amount, target.currency)} {target.name}."
        ),
        context=context,
    )
    db.commit()
    db.refresh(tx)
    return tx


def cancel_transfer(
    db: Session, tx: CashTransfer, reason: str, *, actor: User, context: RequestContext
) -> CashTransfer:
    if tx.status != DocStatus.ACTIVE:
        raise DomainError("Bu transfer zaten iptal edilmiş.")
    if not reason:
        raise DomainError("İptal sebebini yazın.")
    common.assert_cash_available(db, tx.to_account, tx.to_amount)
    entry = db.get(JournalEntry, tx.entry_id)
    ledger.reverse(
        db,
        entry,
        entry_date=clock.today(),
        description=f"Transfer iptali. Sebep: {reason}",
        actor=actor,
    )  # type: ignore[arg-type]
    tx.status = DocStatus.CANCELLED
    tx.cancel_reason = reason
    audit.record(
        db,
        actor=actor,
        action="cash.transfer_cancel",
        entity_type="cash_account",
        entity_id=tx.from_account_id,
        summary=f"Transfer iptal edildi. Sebep: {reason}",
        context=context,
    )
    db.commit()
    db.refresh(tx)
    return tx
