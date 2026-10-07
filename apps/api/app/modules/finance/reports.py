"""Finans okuma modelleri: özetler, ekstreler, etkinlik finansı."""

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.money import ZERO, money
from app.modules.events.models import Event, EventStatus
from app.modules.finance import cash, ledger, partners
from app.modules.finance.agreements import cancel_settlement
from app.modules.finance.collections import collected_amount, remaining_amount, written_off_amount
from app.modules.finance.expenses import expense_payable
from app.modules.finance.models import (
    Account,
    CashAccount,
    Collection,
    DocStatus,
    EntryKind,
    Expense,
    ExpensePaidBy,
    JournalEntry,
    JournalLine,
    PartnerTransaction,
    Payable,
    PayablePayment,
    PaymentPlan,
)
from app.modules.finance.payables import paid_amount
from app.modules.finance.schemas import (
    CashAccountRead,
    CollectionRead,
    CurrencyAmount,
    EventFinance,
    ExpenseRead,
    FinanceOverview,
    Movement,
    OverviewTotals,
    PartnerBalance,
    PartnerTxRead,
    PayableRead,
    PaymentPlanRead,
    PaymentRead,
    StatementLine,
)
from app.modules.offers.schemas import Ref
from app.modules.partners.models import Partner


def _ref(obj, name_attr: str = "name") -> Ref | None:  # noqa: ANN001
    return Ref(id=obj.id, name=getattr(obj, name_attr)) if obj else None


def _event_ref(event: Event | None) -> Ref | None:
    return Ref(id=event.id, name=f"{event.event_no} · {event.title}") if event else None


# --- Belge okuma ---


def collection_read(c: Collection) -> CollectionRead:
    destination = (
        c.cash_account.name if c.cash_account else f"{c.partner.full_name} (ortak üzerinde)"  # type: ignore[union-attr]
    )
    return CollectionRead(
        id=c.id,
        collection_no=c.collection_no,
        status=c.status,
        event=_event_ref(c.event),  # type: ignore[arg-type]
        customer=_ref(c.customer),  # type: ignore[arg-type]
        collection_date=c.collection_date,
        amount=c.amount,
        currency=c.currency,
        rate=c.rate,
        applied_amount=c.applied_amount,
        event_currency=c.event.currency,
        destination=destination,
        cash_account_id=c.cash_account_id,
        partner_id=c.partner_id,
        method=c.method,
        document_no=c.document_no,
        note=c.note,
        cancel_reason=c.cancel_reason,
        created_at=c.created_at,
    )


def payment_read(p: PayablePayment) -> PaymentRead:
    source = p.cash_account.name if p.cash_account else f"{p.partner.full_name} cebinden"  # type: ignore[union-attr]
    return PaymentRead(
        id=p.id,
        payment_no=p.payment_no,
        status=p.status,
        payable_id=p.payable_id,
        payment_date=p.payment_date,
        amount=p.amount,
        currency=p.currency,
        rate=p.rate,
        applied_amount=p.applied_amount,
        source=source,
        method=p.method,
        document_no=p.document_no,
        note=p.note,
        cancel_reason=p.cancel_reason,
    )


def payable_read(db: Session, payable: Payable) -> PayableRead:
    paid = paid_amount(db, payable.id)
    remaining = money(payable.amount - paid)
    if payable.status == DocStatus.CANCELLED:
        state = "cancelled"
    elif remaining == 0:
        state = "paid"
    elif paid > 0:
        state = "partial"
    else:
        state = "open"
    payee = payable.artist or payable.supplier
    payments = db.scalars(
        select(PayablePayment)
        .where(PayablePayment.payable_id == payable.id)
        .order_by(PayablePayment.id)
    ).all()
    return PayableRead(
        id=payable.id,
        status=payable.status,
        state=state,
        event=_event_ref(payable.event),
        payee=Ref(id=payee.id, name=payee.name) if payee else None,
        payee_type="artist" if payable.artist else ("supplier" if payable.supplier else None),
        title=payable.title,
        amount=payable.amount,
        currency=payable.currency,
        rate=payable.rate,
        paid_amount=paid,
        remaining_amount=remaining if payable.status == DocStatus.ACTIVE else ZERO,
        remaining_base=-ledger.balance(db, Account.SUPPLIER_PAYABLE, payable_id=payable.id),
        due_date=payable.due_date,
        is_overdue=bool(
            state in {"open", "partial"} and payable.due_date and payable.due_date < clock.today()
        ),
        from_expense=payable.expense_id is not None,
        note=payable.note,
        payments=[payment_read(p) for p in payments],
    )


def expense_read(db: Session, e: Expense) -> ExpenseRead:
    if e.paid_by == ExpensePaidBy.COMPANY:
        paid_from = e.cash_account.name if e.cash_account else "Kasa"
    elif e.paid_by == ExpensePaidBy.PARTNER:
        paid_from = f"{e.partner.full_name} cebinden" if e.partner else "Ortak"
    else:
        paid_from = f"Ödenmedi{f' · {e.supplier.name}' if e.supplier else ''}"
    payable = expense_payable(db, e) if e.paid_by == ExpensePaidBy.UNPAID else None
    return ExpenseRead(
        id=e.id,
        expense_no=e.expense_no,
        status=e.status,
        expense_date=e.expense_date,
        category=e.category,
        title=e.title,
        event=_event_ref(e.event),
        amount=e.amount,
        currency=e.currency,
        base_amount=money(e.amount * e.rate),
        paid_by=e.paid_by,
        allocation=e.allocation,
        spread_from=e.spread_from,
        spread_until=e.spread_until,
        paid_from=paid_from,
        payable_id=payable.id if payable else None,
        document_no=e.document_no,
        note=e.note,
        cancel_reason=e.cancel_reason,
    )


def partner_tx_read(tx: PartnerTransaction) -> PartnerTxRead:
    return PartnerTxRead(
        id=tx.id,
        status=tx.status,
        kind=tx.kind,
        partner=Ref(id=tx.partner.id, name=tx.partner.full_name),
        tx_date=tx.tx_date,
        amount=tx.amount,
        currency=tx.currency,
        cash_account=_ref(tx.cash_account),
        note=tx.note,
        cancel_reason=tx.cancel_reason,
    )


def cash_account_read(db: Session, account: CashAccount) -> CashAccountRead:
    amount, base = cash.account_balance(db, account)
    return CashAccountRead(
        id=account.id,
        name=account.name,
        account_type=account.account_type,
        currency=account.currency,
        iban=account.iban,
        is_active=account.is_active,
        balance=amount,
        balance_base=base,
    )


# --- Ödeme planı karşılama ---


def plan_reads(db: Session, event: Event) -> list[PaymentPlanRead]:
    """Tahsil edilen tutar planlara vade sırasıyla dağıtılır."""
    plans = db.scalars(
        select(PaymentPlan)
        .where(PaymentPlan.event_id == event.id)
        .order_by(PaymentPlan.due_date, PaymentPlan.sort_order, PaymentPlan.id)
    ).all()
    pool = collected_amount(db, event.id)
    today = clock.today()
    result = []
    for plan in plans:
        covered = min(plan.amount, pool)
        pool -= covered
        if covered == plan.amount:
            state = "paid"
        elif plan.due_date < today:
            state = "overdue"
        elif covered > 0:
            state = "partial"
        else:
            state = "open"
        result.append(
            PaymentPlanRead(
                id=plan.id,
                title=plan.title,
                due_date=plan.due_date,
                amount=plan.amount,
                covered_amount=covered,
                state=state,
            )
        )
    return result


# --- Etkinlik finansı ---


def event_finance(db: Session, event: Event) -> EventFinance:
    plans = plan_reads(db, event)
    plan_total = sum((p.amount for p in plans), ZERO)
    collections = db.scalars(
        select(Collection)
        .where(Collection.event_id == event.id)
        .order_by(Collection.collection_date, Collection.id)
    ).all()
    payables = db.scalars(
        select(Payable).where(Payable.event_id == event.id).order_by(Payable.id)
    ).all()
    expenses = db.scalars(
        select(Expense)
        .where(Expense.event_id == event.id)
        .order_by(Expense.expense_date, Expense.id)
    ).all()
    collected = collected_amount(db, event.id)

    def event_balance(account: Account) -> Decimal:
        return ledger.balance(db, account, event_id=event.id)

    revenue = -event_balance(Account.REVENUE)
    cost = event_balance(Account.EVENT_COST)
    expense = event_balance(Account.EXPENSE)
    fx = -event_balance(Account.FX_DIFFERENCE)
    payable_reads = [payable_read(db, p) for p in payables]
    kept, refunded = cancel_settlement(db, event.id)
    return EventFinance(
        event_id=event.id,
        currency=event.currency,
        exchange_rate=event.exchange_rate,
        total_amount=event.total_amount if event.status != EventStatus.CANCELLED else ZERO,
        collected_amount=collected,
        written_off_amount=written_off_amount(db, event.id),
        remaining_amount=remaining_amount(db, event)
        if event.status != EventStatus.CANCELLED
        else ZERO,
        receivable_base=ledger.balance(db, Account.CUSTOMER_RECEIVABLE, event_id=event.id),
        plan_total=plan_total,
        plan_difference=money(event.total_amount - plan_total),
        plans=plans,
        collections=[collection_read(c) for c in collections],
        payables=payable_reads,
        expenses=[expense_read(db, e) for e in expenses],
        revenue_base=revenue,
        cost_base=cost,
        expense_base=expense,
        fx_base=fx,
        profit_base=money(revenue - cost - expense + fx),
        payables_remaining_base=sum(
            (p.remaining_base for p in payable_reads if p.status == DocStatus.ACTIVE), ZERO
        ),
        cancel_kept_amount=kept,
        cancel_refunded_amount=refunded,
    )


# --- Ekstreler ---


def _statement(lines: list[JournalLine], *, owed: bool = False) -> list[StatementLine]:
    """Yürüyen bakiyeli ekstre. owed=True: bakiye "bizim borcumuz" yönünde (alacak − borç)."""
    running = ZERO
    result = []
    for line in lines:
        running += (line.credit - line.debit) if owed else (line.debit - line.credit)
        result.append(
            StatementLine(
                entry_id=line.entry.id,
                entry_no=line.entry.entry_no,
                entry_date=line.entry.entry_date,
                description=line.entry.description,
                account=line.account,
                debit=line.debit,
                credit=line.credit,
                amount=line.amount,
                currency=line.currency,
                running_base=money(running),
                event_id=line.event_id,
                is_reversal=line.entry.kind == EntryKind.REVERSAL,
            )
        )
    return result


def customer_statement(db: Session, customer_id: int) -> list[StatementLine]:
    lines = db.scalars(
        select(JournalLine)
        .join(JournalEntry)
        .where(
            JournalLine.account == Account.CUSTOMER_RECEIVABLE,
            JournalLine.customer_id == customer_id,
        )
        .order_by(JournalEntry.entry_date, JournalEntry.id, JournalLine.id)
    ).all()
    return _statement(list(lines))


def payee_statement(
    db: Session, *, artist_id: int | None = None, supplier_id: int | None = None
) -> list[StatementLine]:
    """Sanatçı/tedarikçi carisi: borçlanma alacak, ödeme borç; bakiye = kalan borcumuz."""
    payee = Payable.artist_id == artist_id if artist_id else Payable.supplier_id == supplier_id
    lines = db.scalars(
        select(JournalLine)
        .join(JournalEntry)
        .join(Payable, Payable.id == JournalLine.payable_id)
        .where(JournalLine.account == Account.SUPPLIER_PAYABLE, payee)
        .order_by(JournalEntry.entry_date, JournalEntry.id, JournalLine.id)
    ).all()
    return _statement(list(lines), owed=True)


def partner_statement(db: Session, partner: Partner) -> list[StatementLine]:
    return _statement(partners.statement_lines(db, partner))


def cash_movements(db: Session, account: CashAccount) -> list[Movement]:
    lines = db.scalars(
        select(JournalLine)
        .join(JournalEntry)
        .where(JournalLine.account == Account.CASH, JournalLine.cash_account_id == account.id)
        .order_by(JournalEntry.entry_date, JournalEntry.id, JournalLine.id)
    ).all()
    running = ZERO
    result = []
    for line in lines:
        running += line.amount
        result.append(
            Movement(
                entry_id=line.entry.id,
                entry_no=line.entry.entry_no,
                entry_date=line.entry.entry_date,
                description=line.entry.description,
                kind=line.entry.kind,
                amount=line.amount,
                currency=line.currency,
                base=line.debit - line.credit,
                running_amount=money(running),
                event_id=line.event_id,
                is_reversal=line.entry.kind == EntryKind.REVERSAL,
            )
        )
    return result


# --- Genel özet ---


def partner_balances(db: Session) -> list[PartnerBalance]:
    result = []
    for partner in db.scalars(select(Partner).order_by(Partner.sort_order, Partner.id)):
        position = partners.partner_position(db, partner.id)
        held_base = ledger.balance(db, Account.PARTNER_CASH, partner_id=partner.id)
        owed_base = -ledger.balance(db, Account.PARTNER_PAYABLE, partner_id=partner.id)
        if not partner.is_active and held_base == 0 and owed_base == 0:
            continue
        result.append(
            PartnerBalance(
                partner=Ref(id=partner.id, name=partner.full_name),
                held=[CurrencyAmount(currency=c, amount=a) for c, a in position["held"].items()],
                owed=[CurrencyAmount(currency=c, amount=a) for c, a in position["owed"].items()],
                held_base=held_base,
                owed_base=owed_base,
                net_base=money(held_base - owed_base),
            )
        )
    return result


def overview(db: Session) -> FinanceOverview:
    accounts = db.scalars(
        select(CashAccount)
        .where(CashAccount.is_active.is_(True))
        .order_by(CashAccount.sort_order, CashAccount.id)
    ).all()
    receivable_rows = db.execute(
        select(JournalLine.event_id, func.sum(JournalLine.debit - JournalLine.credit))
        .where(JournalLine.account == Account.CUSTOMER_RECEIVABLE)
        .group_by(JournalLine.event_id)
        .having(func.sum(JournalLine.debit - JournalLine.credit) != 0)
    ).all()
    open_receivables = []
    for event_id, base in receivable_rows:
        event = db.get(Event, event_id)
        if event is None:
            continue
        open_receivables.append(
            {
                "event_id": event.id,
                "event_no": event.event_no,
                "title": event.title,
                "customer": event.customer.name,
                "event_date": event.event_date,
                "currency": event.currency,
                "remaining_amount": remaining_amount(db, event),
                "remaining_base": money(base),
            }
        )
    open_receivables.sort(key=lambda r: r["event_date"])

    today = clock.today()
    overdue_plans = 0
    for event in db.scalars(select(Event).where(Event.status != EventStatus.CANCELLED)):
        overdue_plans += sum(1 for p in plan_reads(db, event) if p.state == "overdue")
    overdue_payables = 0
    for payable in db.scalars(
        select(Payable).where(Payable.status == DocStatus.ACTIVE, Payable.due_date < today)
    ):
        if paid_amount(db, payable.id) < payable.amount:
            overdue_payables += 1

    totals = OverviewTotals(
        cash_base=ledger.balance(db, Account.CASH),
        receivables_base=ledger.balance(db, Account.CUSTOMER_RECEIVABLE),
        payables_base=-ledger.balance(db, Account.SUPPLIER_PAYABLE),
        partner_held_base=ledger.balance(db, Account.PARTNER_CASH),
        owed_to_partners_base=-ledger.balance(db, Account.PARTNER_PAYABLE),
        vat_payable_base=-ledger.balance(db, Account.VAT_PAYABLE),
        overdue_plans=overdue_plans,
        overdue_payables=overdue_payables,
    )
    return FinanceOverview(
        totals=totals,
        cash_accounts=[cash_account_read(db, a) for a in accounts],
        partners=partner_balances(db),
        open_receivables=open_receivables,
    )


def trial_balance(db: Session) -> Decimal:
    """Tüm defterin toplamı her zaman sıfırdır (testlerde ve sağlık kontrolünde kullanılır)."""
    return money(
        db.scalar(select(func.coalesce(func.sum(JournalLine.debit - JournalLine.credit), 0)))
    )
