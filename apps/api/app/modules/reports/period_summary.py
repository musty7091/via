"""Dönem özeti: bir ayın genel durumu, kârlılığı, nakit akışı, alacak/borçları ve ortakların
şirkete karşı durumu. Tüm rakamlar defterden, ay sonu itibarıyla (içinde bulunulan ay için
bugün itibarıyla) hesaplanır; böylece sonraki ayların kayıtları geçmiş raporu değiştirmez."""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.money import ZERO, money
from app.core.schemas import ApiModel
from app.modules.closing import periods
from app.modules.closing.models import ClosureStatus, EventClosure
from app.modules.closing.service import month_label
from app.modules.events.models import Event, EventStatus
from app.modules.finance import ledger
from app.modules.finance.models import (
    Account,
    CashAccount,
    Collection,
    DocStatus,
    EntryKind,
    Expense,
    JournalEntry,
    JournalLine,
    Payable,
    PayablePayment,
    PaymentPlan,
    ReceivableWriteOff,
)
from app.modules.finance.payables import payee_name
from app.modules.offers.schemas import Ref
from app.modules.operations.models import OperationReport, ReportStatus
from app.modules.partners.service import list_partners
from app.modules.reports.service import event_results

KIND_LABELS = {
    EntryKind.AGREEMENT: "Anlaşma",
    EntryKind.PAYABLE: "Borç kaydı",
    EntryKind.PAYABLE_ADJUSTMENT: "Borç düzeltmesi",
    EntryKind.COLLECTION: "Tahsilat",
    EntryKind.SUPPLIER_PAYMENT: "Sanatçı / tedarikçi ödemesi",
    EntryKind.EXPENSE: "Gider",
    EntryKind.PARTNER_HANDOVER: "Ortaktan teslim",
    EntryKind.PARTNER_PAYOUT: "Ortağa ödeme",
    EntryKind.PARTNER_OFFSET: "Mahsup",
    EntryKind.CASH_TRANSFER: "Hesaplar arası transfer",
    EntryKind.WRITE_OFF: "Alacak silme",
    EntryKind.EVENT_CLOSE: "Etkinlik kâr/zarar payı",
    EntryKind.PERIOD_CLOSE: "Dönem gideri payı",
    EntryKind.REVERSAL: "İptal (ters kayıt)",
}


# Ortak tablosunda hareketler ortağın gözünden adlandırılır.
PARTNER_LABELS = {
    EntryKind.COLLECTION: "Elden tahsil ettiği",
    EntryKind.PARTNER_HANDOVER: "Kasaya teslim ettiği",
    EntryKind.EXPENSE: "Cebinden ödediği gider",
    EntryKind.SUPPLIER_PAYMENT: "Cebinden ödediği sanatçı/tedarikçi",
    EntryKind.PARTNER_PAYOUT: "Şirketin ona yaptığı ödeme",
    EntryKind.PARTNER_OFFSET: "Mahsup",
    EntryKind.EVENT_CLOSE: "Etkinlik kâr/zarar payı",
    EntryKind.PERIOD_CLOSE: "Dönem gideri payı",
}


# --- Şemalar ---


class CashLine(ApiModel):
    name: str
    currency: str
    opening: Decimal
    inflow: Decimal
    outflow: Decimal
    closing: Decimal
    closing_base: Decimal


class FlowLine(ApiModel):
    label: str
    inflow_base: Decimal
    outflow_base: Decimal


class CurrencyPosition(ApiModel):
    currency: str
    cash: Decimal
    partner_held: Decimal
    receivable: Decimal
    payable: Decimal
    net: Decimal


class Position(ApiModel):
    cash_base: Decimal
    partner_held_base: Decimal
    receivables_base: Decimal
    payables_base: Decimal
    vat_payable_base: Decimal
    owed_to_partners_base: Decimal
    net_base: Decimal


class EventLine(ApiModel):
    event_id: int
    event_no: str
    title: str
    customer: str
    partner: str
    event_date: date
    status: EventStatus
    currency: str
    total_amount: Decimal
    revenue: Decimal
    cost: Decimal
    expense: Decimal
    fx: Decimal
    profit: Decimal
    margin: Decimal | None
    receivable_base: Decimal
    closed: bool
    report_submitted: bool


class PartnerSales(ApiModel):
    partner: str
    event_count: int
    revenue: Decimal
    profit: Decimal


class CategoryLine(ApiModel):
    category: str
    amount_base: Decimal
    items: int


class Profitability(ApiModel):
    event_count: int
    revenue: Decimal
    event_costs: Decimal
    event_profit: Decimal
    margin: Decimal | None
    realized_profit: Decimal
    general_expenses: Decimal
    general_fx: Decimal
    month_result: Decimal
    by_partner: list[PartnerSales]
    expense_categories: list[CategoryLine]
    event_expenses_base: Decimal


class ReceivableLine(ApiModel):
    event_id: int
    event_no: str
    title: str
    customer: Ref
    event_date: date
    currency: str
    total: Decimal
    collected: Decimal
    written_off: Decimal
    remaining: Decimal
    remaining_base: Decimal
    due_date: date | None
    overdue_days: int


class PayableLine(ApiModel):
    payable_id: int
    title: str
    payee: str | None
    payee_type: str | None
    event: str | None
    currency: str
    amount: Decimal
    paid: Decimal
    remaining: Decimal
    remaining_base: Decimal
    due_date: date | None
    overdue_days: int


class PartnerMovement(ApiModel):
    label: str
    held: Decimal  # ortak üzerindeki şirket parasına etkisi (+ arttı)
    owed: Decimal  # şirketin ortağa borcuna etkisi (+ arttı)


class PartnerLine(ApiModel):
    partner_id: int
    name: str
    opening_held: Decimal
    opening_owed: Decimal
    movements: list[PartnerMovement]
    closing_held: Decimal
    closing_owed: Decimal
    net: Decimal  # + şirket ortağa borçlu, − ortak şirkete borçlu
    held_by_currency: dict[str, Decimal]


class PeriodSummary(ApiModel):
    month: str
    label: str
    as_of: date
    status: str
    position: Position
    currencies: list[CurrencyPosition]
    cash: list[CashLine]
    cash_flow: list[FlowLine]
    profitability: Profitability
    events: list[EventLine]
    receivables: list[ReceivableLine]
    payables: list[PayableLine]
    partners: list[PartnerLine]
    distribution_preview: list[periods.DistributionShare]
    warnings: list[str]
    upcoming_events: int
    upcoming_advances_base: Decimal


# --- Yardımcılar ---


def tr(value: Decimal) -> str:
    """Türkçe sayı biçimi: 177.280,48"""
    return f"{value:,.2f}".replace(",", "§").replace(".", ",").replace("§", ".")


def _sum(db: Session, query) -> Decimal:  # noqa: ANN001
    return money(db.scalar(query) or 0)


def _base_balance(db: Session, account: Account, as_of: date, **filters: object) -> Decimal:
    return ledger.balance(db, account, as_of=as_of, **filters)


def _in_month(start: date, end: date):  # noqa: ANN202
    return (JournalEntry.entry_date >= start) & (JournalEntry.entry_date <= end)


# --- Bölümler ---


def _cash(db: Session, start: date, as_of: date) -> list[CashLine]:
    result = []
    day_before = start - timedelta(days=1)
    for account in db.scalars(select(CashAccount).order_by(CashAccount.sort_order, CashAccount.id)):
        opening = ledger.amount_balance(
            db, Account.CASH, as_of=day_before, cash_account_id=account.id
        ).get(account.currency, ZERO)
        moves = db.execute(
            select(JournalLine.amount)
            .join(JournalEntry)
            .where(
                JournalLine.account == Account.CASH,
                JournalLine.cash_account_id == account.id,
                JournalLine.currency == account.currency,
                JournalEntry.entry_date >= start,
                JournalEntry.entry_date <= as_of,
            )
        ).scalars()
        inflow = outflow = ZERO
        for amount in moves:
            if amount > 0:
                inflow += amount
            else:
                outflow -= amount
        closing = money(opening + inflow - outflow)
        if not (opening or inflow or outflow or account.is_active):
            continue
        result.append(
            CashLine(
                name=account.name,
                currency=account.currency,
                opening=money(opening),
                inflow=money(inflow),
                outflow=money(outflow),
                closing=closing,
                closing_base=_base_balance(db, Account.CASH, as_of, cash_account_id=account.id),
            )
        )
    return result


def _cash_flow(db: Session, start: date, as_of: date) -> list[FlowLine]:
    rows = db.execute(
        select(JournalEntry.kind, JournalLine.debit, JournalLine.credit)
        .join(JournalEntry)
        .where(
            JournalLine.account == Account.CASH,
            JournalEntry.entry_date >= start,
            JournalEntry.entry_date <= as_of,
        )
    ).all()
    sums: dict[str, list[Decimal]] = defaultdict(lambda: [ZERO, ZERO])
    for kind, debit, credit in rows:
        sums[kind][0] += debit
        sums[kind][1] += credit
    order = list(KIND_LABELS)
    return [
        FlowLine(label=KIND_LABELS.get(kind, kind), inflow_base=money(i), outflow_base=money(o))
        for kind, (i, o) in sorted(
            sums.items(), key=lambda kv: order.index(kv[0]) if kv[0] in order else 99
        )
    ]


def _receivables(db: Session, as_of: date) -> list[ReceivableLine]:
    rows = db.execute(
        select(JournalLine.event_id, func.sum(JournalLine.debit - JournalLine.credit))
        .join(JournalEntry)
        .where(JournalLine.account == Account.CUSTOMER_RECEIVABLE, JournalEntry.entry_date <= as_of)
        .group_by(JournalLine.event_id)
    ).all()
    result = []
    for event_id, base in rows:
        if not event_id or money(base) <= 0:
            continue
        event = db.get(Event, event_id)
        collected = _sum(
            db,
            select(func.sum(Collection.applied_amount)).where(
                Collection.event_id == event_id,
                Collection.status == DocStatus.ACTIVE,
                Collection.collection_date <= as_of,
            ),
        )
        written = _sum(
            db,
            select(func.sum(ReceivableWriteOff.amount))
            .join(JournalEntry, JournalEntry.id == ReceivableWriteOff.entry_id)
            .where(
                ReceivableWriteOff.event_id == event_id,
                ReceivableWriteOff.status == DocStatus.ACTIVE,
                JournalEntry.entry_date <= as_of,
            ),
        )
        remaining = money(event.total_amount - collected - written)
        # Vade: ödenmemiş ilk plan kaleminin tarihi
        due, covered = None, collected + written
        for plan in db.scalars(
            select(PaymentPlan)
            .where(PaymentPlan.event_id == event_id)
            .order_by(PaymentPlan.sort_order, PaymentPlan.due_date)
        ):
            if covered >= plan.amount:
                covered -= plan.amount
                continue
            due = plan.due_date
            break
        result.append(
            ReceivableLine(
                event_id=event.id,
                event_no=event.event_no,
                title=event.title,
                customer=Ref(id=event.customer.id, name=event.customer.name),
                event_date=event.event_date,
                currency=event.currency,
                total=event.total_amount,
                collected=collected,
                written_off=written,
                remaining=remaining,
                remaining_base=money(base),
                due_date=due,
                overdue_days=max(0, (as_of - due).days) if due else 0,
            )
        )
    return sorted(result, key=lambda r: (-r.overdue_days, -r.remaining_base))


def _payables(db: Session, as_of: date) -> list[PayableLine]:
    rows = db.execute(
        select(JournalLine.payable_id, func.sum(JournalLine.credit - JournalLine.debit))
        .join(JournalEntry)
        .where(JournalLine.account == Account.SUPPLIER_PAYABLE, JournalEntry.entry_date <= as_of)
        .group_by(JournalLine.payable_id)
    ).all()
    result = []
    for payable_id, base in rows:
        if not payable_id or money(base) <= 0:
            continue
        payable = db.get(Payable, payable_id)
        paid = _sum(
            db,
            select(func.sum(PayablePayment.applied_amount)).where(
                PayablePayment.payable_id == payable_id,
                PayablePayment.status == DocStatus.ACTIVE,
                PayablePayment.payment_date <= as_of,
            ),
        )
        due = payable.due_date
        result.append(
            PayableLine(
                payable_id=payable.id,
                title=payable.title,
                payee=payee_name(payable),
                payee_type="artist"
                if payable.artist_id
                else "supplier"
                if payable.supplier_id
                else None,
                event=payable.event.title if payable.event else None,
                currency=payable.currency,
                amount=payable.amount,
                paid=paid,
                remaining=money(payable.amount - paid),
                remaining_base=money(base),
                due_date=due,
                overdue_days=max(0, (as_of - due).days) if due else 0,
            )
        )
    return sorted(result, key=lambda r: (-r.overdue_days, -r.remaining_base))


def _partners(db: Session, start: date, as_of: date) -> list[PartnerLine]:
    day_before = start - timedelta(days=1)
    result = []
    for partner in list_partners(db, include_inactive=True):
        opening_held = _base_balance(db, Account.PARTNER_CASH, day_before, partner_id=partner.id)
        opening_owed = -_base_balance(
            db, Account.PARTNER_PAYABLE, day_before, partner_id=partner.id
        )
        closing_held = _base_balance(db, Account.PARTNER_CASH, as_of, partner_id=partner.id)
        closing_owed = -_base_balance(db, Account.PARTNER_PAYABLE, as_of, partner_id=partner.id)
        moves: dict[str, list[Decimal]] = defaultdict(lambda: [ZERO, ZERO])
        for kind, account, debit, credit in db.execute(
            select(JournalEntry.kind, JournalLine.account, JournalLine.debit, JournalLine.credit)
            .join(JournalEntry)
            .where(
                JournalLine.partner_id == partner.id,
                JournalLine.account.in_([Account.PARTNER_CASH, Account.PARTNER_PAYABLE]),
                JournalEntry.entry_date >= start,
                JournalEntry.entry_date <= as_of,
            )
        ):
            label = PARTNER_LABELS.get(kind) or KIND_LABELS.get(kind, kind)
            if account == Account.PARTNER_CASH:
                moves[label][0] += debit - credit
            else:
                moves[label][1] += credit - debit
        held_by_currency = {
            currency: amount
            for currency, amount in ledger.amount_balance(
                db, Account.PARTNER_CASH, as_of=as_of, partner_id=partner.id
            ).items()
        }
        if (
            not (opening_held or opening_owed or closing_held or closing_owed or moves)
            and not partner.is_active
        ):
            continue
        result.append(
            PartnerLine(
                partner_id=partner.id,
                name=partner.full_name,
                opening_held=opening_held,
                opening_owed=opening_owed,
                movements=[
                    PartnerMovement(label=label, held=money(h), owed=money(o))
                    for label, (h, o) in moves.items()
                    if h or o
                ],
                closing_held=closing_held,
                closing_owed=closing_owed,
                net=money(closing_owed - closing_held),
                held_by_currency=held_by_currency,
            )
        )
    return result


def _currencies(
    db: Session, as_of: date, receivables: list[ReceivableLine], payables: list[PayableLine]
) -> list[CurrencyPosition]:
    totals: dict[str, list[Decimal]] = defaultdict(lambda: [ZERO, ZERO, ZERO, ZERO])
    for currency, amount in ledger.amount_balance(db, Account.CASH, as_of=as_of).items():
        totals[currency][0] += amount
    for currency, amount in ledger.amount_balance(db, Account.PARTNER_CASH, as_of=as_of).items():
        totals[currency][1] += amount
    for r in receivables:
        totals[r.currency][2] += r.remaining
    for p in payables:
        totals[p.currency][3] += p.remaining
    order = ["TRY", "EUR", "GBP", "USD"]
    return [
        CurrencyPosition(
            currency=c,
            cash=money(v[0]),
            partner_held=money(v[1]),
            receivable=money(v[2]),
            payable=money(v[3]),
            net=money(v[0] + v[1] + v[2] - v[3]),
        )
        for c, v in sorted(
            totals.items(), key=lambda kv: order.index(kv[0]) if kv[0] in order else 9
        )
        if any(v)
    ]


def _expense_categories(
    db: Session, start: date, end: date, spread: list
) -> tuple[list[CategoryLine], Decimal]:  # noqa: ANN001
    from app.modules.finance.models import ExpenseCategory  # noqa: PLC0415

    labels = {
        ExpenseCategory.RENT: "Kira",
        ExpenseCategory.SALARY: "Maaş",
        ExpenseCategory.TRANSPORT: "Ulaşım / yakıt",
        ExpenseCategory.MARKETING: "Reklam",
        ExpenseCategory.OFFICE: "Ofis",
        ExpenseCategory.TAX_FEES: "Vergi / harç / muhasebe",
        ExpenseCategory.EQUIPMENT: "Ekipman",
        ExpenseCategory.FOOD: "Yemek",
        ExpenseCategory.OTHER: "Diğer",
    }
    totals: dict[str, list] = defaultdict(lambda: [ZERO, 0])
    event_total = ZERO
    for expense in db.scalars(
        select(Expense).where(
            Expense.status == DocStatus.ACTIVE,
            Expense.expense_date >= start,
            Expense.expense_date <= end,
        )
    ):
        base = money(expense.amount * expense.rate)
        if expense.event_id:
            event_total += base
            continue
        if expense.spread_until:
            continue  # aylara bölünen gider aşağıda payıyla eklenir
        totals[labels.get(expense.category, expense.category)][0] += base
        totals[labels.get(expense.category, expense.category)][1] += 1
    for item in spread:
        totals["Aylara bölünen giderler (bu ayın payı)"][0] += item.share
        totals["Aylara bölünen giderler (bu ayın payı)"][1] += 1
    lines = [
        CategoryLine(category=k, amount_base=money(v[0]), items=v[1]) for k, v in totals.items()
    ]
    return sorted(lines, key=lambda c: -c.amount_base), money(event_total)


# --- Rapor ---


def period_summary(db: Session, month: str) -> PeriodSummary:
    start, end = periods.parse_month(month)
    today = clock.today()
    as_of = min(end, today)
    preview = periods.preview(db, month)

    events = list(
        db.scalars(
            select(Event)
            .where(
                Event.status != EventStatus.CANCELLED,
                Event.event_date >= start,
                Event.event_date <= end,
            )
            .order_by(Event.event_date, Event.id)
        )
    )
    results = event_results(db, [e.id for e in events])
    closed = set(
        db.scalars(
            select(EventClosure.event_id).where(
                EventClosure.status == ClosureStatus.CLOSED,
                EventClosure.event_id.in_([e.id for e in events]),
            )
        )
    )
    submitted = set(
        db.scalars(
            select(OperationReport.event_id).where(
                OperationReport.status == ReportStatus.SUBMITTED,
                OperationReport.event_id.in_([e.id for e in events]),
            )
        )
    )
    event_lines = []
    for e in events:
        r = results[e.id]
        event_lines.append(
            EventLine(
                event_id=e.id,
                event_no=e.event_no,
                title=e.title,
                customer=e.customer.name,
                partner=e.partner.full_name,
                event_date=e.event_date,
                status=e.status,
                currency=e.currency,
                total_amount=e.total_amount,
                revenue=r["revenue"],
                cost=r["cost"],
                expense=r["expense"],
                fx=r["fx"],
                profit=r["profit"],
                margin=money(r["profit"] / r["revenue"] * 100) if r["revenue"] else None,
                receivable_base=r["receivable"],
                closed=e.id in closed,
                report_submitted=e.id in submitted,
            )
        )

    revenue = money(sum((x.revenue for x in event_lines), ZERO))
    profit = money(sum((x.profit for x in event_lines), ZERO))
    by_partner: dict[str, list] = defaultdict(lambda: [0, ZERO, ZERO])
    for x in event_lines:
        by_partner[x.partner][0] += 1
        by_partner[x.partner][1] += x.revenue
        by_partner[x.partner][2] += x.profit
    categories, event_expenses = _expense_categories(db, start, end, preview.general.spread_items)

    receivables = _receivables(db, as_of)
    payables_ = _payables(db, as_of)
    partners_ = _partners(db, start, as_of)
    cash = _cash(db, start, as_of)

    position = Position(
        cash_base=money(sum((c.closing_base for c in cash), ZERO)),
        partner_held_base=money(sum((p.closing_held for p in partners_), ZERO)),
        receivables_base=money(sum((r.remaining_base for r in receivables), ZERO)),
        payables_base=money(sum((p.remaining_base for p in payables_), ZERO)),
        vat_payable_base=-_base_balance(db, Account.VAT_PAYABLE, as_of),
        owed_to_partners_base=money(sum((p.closing_owed for p in partners_), ZERO)),
        net_base=ZERO,
    )
    position.net_base = money(
        position.cash_base
        + position.partner_held_base
        + position.receivables_base
        - position.payables_base
        - position.vat_payable_base
        - position.owed_to_partners_base
    )

    upcoming = list(
        db.scalars(
            select(Event).where(Event.status == EventStatus.PLANNED, Event.event_date > as_of)
        )
    )
    upcoming_advances = (
        _sum(
            db,
            select(func.sum(Collection.amount * Collection.rate)).where(
                Collection.status == DocStatus.ACTIVE,
                Collection.collection_date <= as_of,
                Collection.event_id.in_([e.id for e in upcoming]),
            ),
        )
        if upcoming
        else ZERO
    )

    warnings = []
    overdue_r = [r for r in receivables if r.overdue_days > 0]
    if overdue_r:
        warnings.append(
            f"{len(overdue_r)} müşteri alacağının vadesi geçti "
            f"(toplam {tr(sum((r.remaining_base for r in overdue_r), ZERO))} TL)."
        )
    overdue_p = [p for p in payables_ if p.overdue_days > 0]
    if overdue_p:
        warnings.append(
            f"{len(overdue_p)} sanatçı/tedarikçi borcunun vadesi geçti "
            f"(toplam {tr(sum((p.remaining_base for p in overdue_p), ZERO))} TL)."
        )
    for p in partners_:
        if p.closing_held > 0:
            held = ", ".join(f"{tr(v)} {c}" for c, v in p.held_by_currency.items())
            warnings.append(f"{p.name} üzerinde şirkete teslim edilmemiş para var: {held}.")
    unclosed = [x for x in event_lines if x.status == EventStatus.COMPLETED and not x.closed]
    if unclosed:
        warnings.append(
            f"Gerçekleşmiş ama finans kapanışı yapılmamış {len(unclosed)} etkinlik var."
        )
    missing_reports = [
        x for x in event_lines if x.status == EventStatus.COMPLETED and not x.report_submitted
    ]
    if missing_reports:
        warnings.append(f"{len(missing_reports)} etkinliğin operasyon raporu teslim edilmedi.")
    if position.vat_payable_base > 0:
        warnings.append(f"Faturalı işlerden doğan KDV: {tr(position.vat_payable_base)} TL.")

    return PeriodSummary(
        month=month,
        label=month_label(start),
        as_of=as_of,
        status=str(preview.status),
        position=position,
        currencies=_currencies(db, as_of, receivables, payables_),
        cash=cash,
        cash_flow=_cash_flow(db, start, as_of),
        profitability=Profitability(
            event_count=len(event_lines),
            revenue=revenue,
            event_costs=money(revenue - profit),
            event_profit=profit,
            margin=money(profit / revenue * 100) if revenue else None,
            realized_profit=preview.closed_events_profit,
            general_expenses=money(
                -preview.general.direct_expenses - preview.general.spread_expenses
            ),
            general_fx=preview.general.fx,
            month_result=preview.month_result,
            by_partner=[
                PartnerSales(partner=k, event_count=v[0], revenue=money(v[1]), profit=money(v[2]))
                for k, v in sorted(by_partner.items(), key=lambda kv: -kv[1][1])
            ],
            expense_categories=categories,
            event_expenses_base=event_expenses,
        ),
        events=event_lines,
        receivables=receivables,
        payables=payables_,
        partners=partners_,
        distribution_preview=preview.distribution_preview,
        warnings=warnings,
        upcoming_events=len(upcoming),
        upcoming_advances_base=upcoming_advances,
    )
