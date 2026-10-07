"""Giderler: genel giderler ve etkinliğe bağlı ek giderler."""

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.deps import RequestContext
from app.core.errors import DomainError, NotFoundError
from app.core.money import Currency, format_money, money
from app.core.sequences import next_number
from app.modules.audit import service as audit
from app.modules.catalog.models import Supplier
from app.modules.closing.service import ensure_event_open
from app.modules.events.models import Event, EventStatus
from app.modules.finance import common, ledger
from app.modules.finance.models import (
    Account,
    DocStatus,
    EntryKind,
    Expense,
    ExpenseAllocation,
    ExpenseCategory,
    ExpensePaidBy,
    JournalEntry,
    Payable,
)
from app.modules.finance.payables import paid_amount
from app.modules.users.models import User


def get_expense(db: Session, expense_id: int) -> Expense:
    expense = db.get(Expense, expense_id)
    if expense is None:
        raise NotFoundError("Gider bulunamadı.")
    return expense


def _allocation_range(
    db: Session, expense_date: date, allocation: ExpenseAllocation, spread_until: str | None
) -> tuple[str | None, str | None]:
    """Giderin bölüneceği ay aralığı. spread_until doğrudan verilirse (eski kullanım)
    gider ayından o aya kadar bölünür."""
    from app.modules.closing.periods import months_range, season_bounds  # noqa: PLC0415
    from app.modules.settings.router import get_company_settings  # noqa: PLC0415

    month = f"{expense_date.year:04d}-{expense_date.month:02d}"
    if allocation == ExpenseAllocation.MONTH and spread_until is None:
        return None, None
    if allocation == ExpenseAllocation.MONTH:
        if spread_until < month:
            raise DomainError("Bölme bitiş ayı gider ayından önce olamaz.")
        if len(months_range(month, spread_until)) > 24:
            raise DomainError("Gider en fazla 24 aya bölünebilir.")
        return month, spread_until
    first, last = season_bounds(month, get_company_settings(db).season_start_month)
    if allocation == ExpenseAllocation.SEASON:
        return first, last
    return month, last


def create_expense(
    db: Session,
    *,
    expense_date: date,
    category: ExpenseCategory,
    title: str,
    amount: Decimal,
    currency: Currency,
    rate: Decimal | None,
    event_id: int | None,
    paid_by: ExpensePaidBy,
    cash_account_id: int | None,
    spread_until: str | None = None,
    allocation: ExpenseAllocation = ExpenseAllocation.MONTH,
    partner_id: int | None,
    supplier_id: int | None,
    document_no: str | None,
    note: str | None,
    actor: User,
    context: RequestContext,
) -> Expense:
    if amount <= 0:
        raise DomainError("Gider tutarı sıfırdan büyük olmalıdır.")
    common.check_date(expense_date)
    rate = common.require_rate(currency, rate)
    event = None
    if event_id is not None:
        event = db.get(Event, event_id)
        if event is None or event.status == EventStatus.CANCELLED:
            raise DomainError("Etkinlik bulunamadı veya iptal edilmiş.")
        ensure_event_open(db, event_id)
    spread_from, spread_until = _allocation_range(db, expense_date, allocation, spread_until)
    if spread_until is not None and event_id is not None:
        raise DomainError("Aylara bölme sadece genel giderlerde kullanılır.")

    expense = Expense(
        expense_no=next_number(db, "expense", expense_date.year, "VIA-GD"),
        expense_date=expense_date,
        category=category,
        title=title,
        event_id=event_id,
        amount=money(amount),
        currency=currency,
        rate=rate,
        paid_by=paid_by,
        allocation=allocation,
        spread_from=spread_from,
        spread_until=spread_until,
        document_no=document_no,
        note=note,
    )
    expense_leg = ledger.leg(Account.EXPENSE, amount, currency, rate, event_id=event_id)

    if paid_by == ExpensePaidBy.COMPANY:
        if cash_account_id is None:
            raise DomainError("Giderin ödendiği kasa/banka hesabını seçin.")
        account = common.get_cash_account(db, cash_account_id, currency)
        common.assert_cash_available(db, account, amount, expense_date)
        expense.cash_account_id = account.id
        counter = ledger.leg(
            Account.CASH,
            amount,
            currency,
            rate,
            credit=True,
            cash_account_id=account.id,
            event_id=event_id,
        )
        where = account.name
    elif paid_by == ExpensePaidBy.PARTNER:
        if partner_id is None:
            raise DomainError("Gideri cebinden ödeyen ortağı seçin.")
        partner = common.get_partner(db, partner_id)
        expense.partner_id = partner.id
        counter = ledger.leg(
            Account.PARTNER_PAYABLE,
            amount,
            currency,
            rate,
            credit=True,
            partner_id=partner.id,
            event_id=event_id,
        )
        where = f"{partner.full_name} cebinden ödedi (şirket ortağa borçlandı)"
    else:
        if supplier_id is not None and db.get(Supplier, supplier_id) is None:
            raise DomainError("Tedarikçi bulunamadı.")
        expense.supplier_id = supplier_id
        db.add(expense)
        db.flush()
        payable = Payable(
            event_id=event_id,
            expense_id=expense.id,
            supplier_id=supplier_id,
            title=title,
            amount=money(amount),
            currency=currency,
            rate=rate,
            due_date=None,
            note=note,
        )
        db.add(payable)
        db.flush()
        counter = ledger.leg(
            Account.SUPPLIER_PAYABLE,
            amount,
            currency,
            rate,
            credit=True,
            payable_id=payable.id,
            event_id=event_id,
        )
        where = "ödenmedi (borç açıldı)"

    entry = ledger.post(
        db,
        kind=EntryKind.EXPENSE,
        entry_date=expense_date,
        description=f"Gider: {title} — {where}",
        legs=[expense_leg, counter],
        actor=actor,
        event_id=event_id,
    )
    expense.entry_id = entry.id
    db.add(expense)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="expense.create",
        entity_type="event" if event_id else "expense",
        entity_id=event_id or expense.id,
        summary=f"{expense.expense_no}: {title} {format_money(amount, currency)} — {where}.",
        context=context,
    )
    db.commit()
    db.refresh(expense)
    return expense


def expense_payable(db: Session, expense: Expense) -> Payable | None:
    return db.scalar(select(Payable).where(Payable.expense_id == expense.id))


def cancel_expense(
    db: Session, expense: Expense, reason: str, *, actor: User, context: RequestContext
) -> Expense:
    if expense.status != DocStatus.ACTIVE:
        raise DomainError("Bu gider zaten iptal edilmiş.")
    if not reason:
        raise DomainError("İptal sebebini yazın.")
    ensure_event_open(db, expense.event_id)
    from app.modules.closing.periods import spread_months_closed  # noqa: PLC0415

    if expense.spread_until and spread_months_closed(db, expense):
        raise DomainError("Bu giderin aylık payları kapanmış dönemlere yansıtıldı; iptal edilemez.")
    payable = expense_payable(db, expense) if expense.paid_by == ExpensePaidBy.UNPAID else None
    if payable is not None and paid_amount(db, payable.id) > 0:
        raise DomainError("Bu giderin borcuna ödeme yapılmış; önce ödemeyi iptal edin.")
    if expense.paid_by == ExpensePaidBy.PARTNER:
        owed, _ = common.carrying(
            db, Account.PARTNER_PAYABLE, expense.currency, partner_id=expense.partner_id
        )
        if expense.amount > -owed:
            raise DomainError("Bu tutar ortağa geri ödenmiş görünüyor; önce o ödemeyi iptal edin.")
    entry = db.get(JournalEntry, expense.entry_id)
    ledger.reverse(
        db,
        entry,  # type: ignore[arg-type]
        entry_date=clock.today(),
        description=f"Gider iptali: {expense.expense_no}. Sebep: {reason}",
        actor=actor,
    )
    if payable is not None:
        payable.status = DocStatus.CANCELLED
        payable.cancel_reason = reason
    expense.status = DocStatus.CANCELLED
    expense.cancel_reason = reason
    audit.record(
        db,
        actor=actor,
        action="expense.cancel",
        entity_type="event" if expense.event_id else "expense",
        entity_id=expense.event_id or expense.id,
        summary=f"{expense.expense_no} gideri iptal edildi. Sebep: {reason}",
        context=context,
    )
    db.commit()
    db.refresh(expense)
    return expense
