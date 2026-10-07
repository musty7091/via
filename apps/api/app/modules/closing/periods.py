"""Aylık dönem kapanışı.

- Ayın genel giderleri (etkinliğe bağlı olmayan) ve şirket geneli kur farkları ortaklara
  eşit yansıtılır. Sezonluk giderler, belirtilen aya kadar eşit aylık paylarla yansıtılır.
- Kapanan aya hiçbir finans kaydı yapılamaz.
- Önceki aylar kapanmadan sonraki ay kapatılamaz; sadece en son kapanan ay geri açılabilir.
- Kapanış anındaki rapor dondurulur (snapshot).
"""

from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select, true
from sqlalchemy.orm import Session

from app.core import clock
from app.core.deps import RequestContext
from app.core.errors import DomainError, NotFoundError
from app.core.money import ZERO, format_money, money, split_evenly
from app.core.schemas import ApiModel
from app.modules.audit import service as audit
from app.modules.closing.distribution import post_distribution, preview_shares
from app.modules.closing.events import needs_closure, profit_date
from app.modules.closing.models import AccountingPeriod, ClosureStatus, EventClosure, PeriodStatus
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
    PayablePayment,
)
from app.modules.partners import service as partner_service
from app.modules.partners.models import Partner
from app.modules.users.models import User


def parse_month(month: str) -> tuple[date, date]:
    try:
        year, mon = (int(x) for x in month.split("-"))
        start = date(year, mon, 1)
    except ValueError as exc:
        raise DomainError("Geçersiz dönem (YYYY-AA olmalı).") from exc
    return start, date(year, mon, monthrange(year, mon)[1])


def month_of(day: date) -> str:
    return f"{day.year:04d}-{day.month:02d}"


def months_range(first: str, last: str) -> list[str]:
    start, _ = parse_month(first)
    end, _ = parse_month(last)
    result = []
    current = start
    while current <= end:
        result.append(month_of(current))
        current = date(current.year + (current.month == 12), current.month % 12 + 1, 1)
    return result


# --- Sezonluk gider payları ---


def season_bounds(month: str, start_month: int) -> tuple[str, str]:
    """Verilen ayın içinde bulunduğu sezonun ilk ve son ayı (sezon 12 ay)."""
    year, mon = (int(x) for x in month.split("-"))
    first_year = year if mon >= start_month else year - 1
    first = f"{first_year:04d}-{start_month:02d}"
    last_index = start_month - 1 + 11
    last = f"{first_year + last_index // 12:04d}-{last_index % 12 + 1:02d}"
    return first, last


def spread_months(expense: Expense) -> list[str]:
    """Giderin ait olduğu aylar (bölünmüyorsa sadece gider ayı)."""
    expense_month = month_of(expense.expense_date)
    if not expense.spread_until:
        return [expense_month]
    return months_range(expense.spread_from or expense_month, expense.spread_until)


def recognized_shares(expense: Expense) -> dict[str, Decimal]:
    """Her aya yazılacak pay. Gider ayından önceki ayların payı gider ayında toplanır
    (geçmiş ve kapanmış aylara kayıt yapılmaz); kalan aylar eşit pay alır."""
    months = spread_months(expense)
    base = money(expense.amount * expense.rate)
    shares = split_evenly(base, len(months))
    expense_month = month_of(expense.expense_date)
    result: dict[str, Decimal] = {}
    for month, share in zip(months, shares, strict=True):
        key = max(month, expense_month)
        result[key] = result.get(key, ZERO) + share
    return result


def spread_share(expense: Expense, month: str) -> Decimal:
    return recognized_shares(expense).get(month, ZERO)


def _spread_expenses(db: Session) -> list[Expense]:
    return list(
        db.scalars(
            select(Expense).where(
                Expense.spread_until.is_not(None),
                Expense.event_id.is_(None),
                Expense.status == DocStatus.ACTIVE,
            )
        )
    )


def _spread_entry_ids(db: Session) -> list[int]:
    """Sezonluk giderlerin (iptal edilenler dahil) fişleri ve ters kayıtları: aylık
    yansıtma bunlar yerine paylarla yapılır."""
    entry_ids = [
        e.entry_id
        for e in db.scalars(
            select(Expense).where(Expense.spread_until.is_not(None), Expense.event_id.is_(None))
        )
        if e.entry_id
    ]
    reversals = db.scalars(
        select(JournalEntry.id).where(JournalEntry.reverses_id.in_(entry_ids))
    ).all()
    return entry_ids + list(reversals)


class SpreadShare(ApiModel):
    expense_no: str
    title: str
    share: Decimal
    months: int


class GeneralResult(ApiModel):
    """Ayın genel sonucu (TL). Ortaklara yansıtılacak tutar = −(gider) + kur farkı."""

    direct_expenses: Decimal
    spread_expenses: Decimal
    spread_items: list[SpreadShare]
    fx: Decimal
    total: Decimal


def general_result(db: Session, month: str) -> GeneralResult:
    start, end = parse_month(month)
    in_month = (JournalEntry.entry_date >= start) & (JournalEntry.entry_date <= end)
    excluded = _spread_entry_ids(db)
    direct = db.scalar(
        select(func.coalesce(func.sum(JournalLine.debit - JournalLine.credit), 0))
        .join(JournalEntry)
        .where(
            JournalLine.account == Account.EXPENSE,
            JournalLine.event_id.is_(None),
            in_month,
            JournalEntry.id.not_in(excluded) if excluded else true(),
        )
    )
    fx = -db.scalar(
        select(func.coalesce(func.sum(JournalLine.debit - JournalLine.credit), 0))
        .join(JournalEntry)
        .where(
            JournalLine.account == Account.FX_DIFFERENCE, JournalLine.event_id.is_(None), in_month
        )
    )
    items = []
    for expense in _spread_expenses(db):
        share = spread_share(expense, month)
        if share:
            items.append(
                SpreadShare(
                    expense_no=expense.expense_no,
                    title=expense.title,
                    share=share,
                    months=len(spread_months(expense)),
                )
            )
    spread_total = sum((i.share for i in items), ZERO)
    direct = money(direct)
    fx = money(fx)
    return GeneralResult(
        direct_expenses=direct,
        spread_expenses=spread_total,
        spread_items=items,
        fx=fx,
        total=money(-direct - spread_total + fx),
    )


# --- Önizleme ---


class AccountBalance(ApiModel):
    name: str
    currency: str
    amount: Decimal
    base: Decimal


class PartnerLine(ApiModel):
    partner_id: int
    name: str
    distributed_in_month: Decimal  # bu ay yazılan kâr(+)/zarar(−) payı
    held_base: Decimal  # ay sonunda ortak üzerindeki şirket parası
    owed_base: Decimal  # ay sonunda şirketin ortağa borcu (− ise ortak şirkete borçlu)


class EventLine(ApiModel):
    event_id: int
    event_no: str
    title: str
    event_date: date
    status: str
    closed: bool
    profit: Decimal | None


class DistributionShare(ApiModel):
    partner_id: int
    name: str
    share: Decimal


class PeriodPreview(ApiModel):
    month: str
    label: str
    status: PeriodStatus
    can_close: bool
    blockers: list[str]
    warnings: list[str]
    cash: list[AccountBalance]
    cash_total_base: Decimal
    receivables_base: Decimal
    payables_base: Decimal
    collections_base: Decimal
    payments_base: Decimal
    closed_events_profit: Decimal
    general: GeneralResult
    month_result: Decimal
    partners: list[PartnerLine]
    events: list[EventLine]
    distribution_preview: list[DistributionShare]


def _earliest_activity_month(db: Session) -> str | None:
    first = db.scalar(select(func.min(JournalEntry.entry_date)))
    return month_of(first) if first else None


def _period(db: Session, month: str) -> AccountingPeriod | None:
    return db.scalar(select(AccountingPeriod).where(AccountingPeriod.month == month))


def _month_events(db: Session, start: date, end: date) -> list[Event]:
    """Sonucu bu aya yazılan etkinlikler: etkinlik günü bu ayda olanlar; iptal edilenler
    için iptal edildiği ay."""
    candidates = db.scalars(
        select(Event)
        .where(
            Event.event_date.between(start, end)
            # Saat dilimi farkı için bir gün geniş aranır; kesin ay profit_date ile seçilir.
            | func.date(Event.cancelled_at).between(
                start - timedelta(days=1), end + timedelta(days=1)
            )
        )
        .order_by(Event.event_date)
    )
    return [e for e in candidates if start <= profit_date(e) <= end]


def _blockers(db: Session, month: str) -> list[str]:
    start, end = parse_month(month)
    blockers = []
    pending = [e for e in _month_events(db, start, end) if needs_closure(db, e)]
    if pending:
        blockers.append(
            "Bu ayın etkinliklerinin finans kapanışı yapılmalı (kâr etkinlik ayına yazılır): "
            + ", ".join(e.event_no for e in pending)
            + "."
        )
    period = _period(db, month)
    if period and period.status == PeriodStatus.CLOSED:
        blockers.append("Bu dönem zaten kapalı.")
    if end >= clock.today():
        blockers.append("Ay bitmeden dönem kapatılamaz.")
    if not partner_service.active_partners(db):
        blockers.append("Önce Ortaklar ekranından aktif ortakları tanımlayın.")
    earliest = _earliest_activity_month(db)
    if earliest and earliest < month:
        closed = set(
            db.scalars(
                select(AccountingPeriod.month).where(AccountingPeriod.status == PeriodStatus.CLOSED)
            )
        )
        missing = [m for m in months_range(earliest, month)[:-1] if m not in closed]
        if missing:
            blockers.append(f"Önce önceki dönemler kapatılmalı: {', '.join(missing)}.")
    return blockers


def preview(db: Session, month: str) -> PeriodPreview:
    start, end = parse_month(month)
    period = _period(db, month)
    if period and period.status == PeriodStatus.CLOSED and period.snapshot:
        # Kapanmış dönemin raporu dondurulmuştur.
        return PeriodPreview.model_validate(
            {
                **period.snapshot,
                "status": PeriodStatus.CLOSED,
                "can_close": False,
                "blockers": ["Bu dönem kapalı."],
            }
        )

    cash = []
    for account in db.scalars(select(CashAccount).order_by(CashAccount.sort_order, CashAccount.id)):
        amount = ledger.amount_balance(db, Account.CASH, as_of=end, cash_account_id=account.id).get(
            account.currency, ZERO
        )
        base = ledger.balance(db, Account.CASH, as_of=end, cash_account_id=account.id)
        if amount or account.is_active:
            cash.append(
                AccountBalance(
                    name=account.name, currency=account.currency, amount=amount, base=base
                )
            )

    collections_base = db.scalar(
        select(func.coalesce(func.sum(Collection.amount * Collection.rate), 0)).where(
            Collection.status == DocStatus.ACTIVE, Collection.collection_date.between(start, end)
        )
    )
    payments_base = db.scalar(
        select(func.coalesce(func.sum(PayablePayment.amount * PayablePayment.rate), 0)).where(
            PayablePayment.status == DocStatus.ACTIVE,
            PayablePayment.payment_date.between(start, end),
        )
    )

    closures = db.scalars(
        select(EventClosure).where(EventClosure.status == ClosureStatus.CLOSED)
    ).all()
    closed_by_event = {c.event_id: c for c in closures}
    month_events = _month_events(db, start, end)
    # Kâr, etkinliğin yapıldığı aya yazılır (kapanışın yapıldığı güne değil).
    closed_profit = sum(
        (closed_by_event[e.id].profit for e in month_events if e.id in closed_by_event), ZERO
    )

    general = general_result(db, month)

    distributed = dict(
        db.execute(
            select(JournalLine.partner_id, func.sum(JournalLine.credit - JournalLine.debit))
            .join(JournalEntry)
            .where(
                JournalLine.account == Account.PARTNER_PAYABLE,
                JournalEntry.kind.in_([EntryKind.EVENT_CLOSE, EntryKind.PERIOD_CLOSE]),
                JournalEntry.entry_date.between(start, end),
            )
            .group_by(JournalLine.partner_id)
        ).all()
    )
    partners = [
        PartnerLine(
            partner_id=p.id,
            name=p.full_name,
            distributed_in_month=money(distributed.get(p.id, 0)),
            held_base=ledger.balance(db, Account.PARTNER_CASH, as_of=end, partner_id=p.id),
            owed_base=-ledger.balance(db, Account.PARTNER_PAYABLE, as_of=end, partner_id=p.id),
        )
        for p in db.scalars(select(Partner).order_by(Partner.sort_order, Partner.id))
    ]

    events = [
        e
        for e in month_events
        if e.status != EventStatus.CANCELLED or e.id in closed_by_event or needs_closure(db, e)
    ]
    event_lines = [
        EventLine(
            event_id=e.id,
            event_no=e.event_no,
            title=e.title,
            event_date=e.event_date,
            status=e.status,
            closed=e.id in closed_by_event,
            profit=closed_by_event[e.id].profit if e.id in closed_by_event else None,
        )
        for e in events
    ]

    warnings = []
    held = sum((p.held_base for p in partners), ZERO)
    if held > 0:
        warnings.append(
            "Ortaklar üzerinde şirkete teslim edilmemiş para var; sonraki aya devreder."
        )
    receivables = ledger.balance(db, Account.CUSTOMER_RECEIVABLE, as_of=end)
    if receivables > 0:
        warnings.append("Açık müşteri alacakları sonraki aya devreder.")

    blockers = _blockers(db, month)
    return PeriodPreview(
        month=month,
        label=month_label(start),
        status=period.status if period else PeriodStatus.OPEN,
        can_close=not blockers,
        blockers=blockers,
        warnings=warnings,
        cash=cash,
        cash_total_base=sum((c.base for c in cash), ZERO),
        receivables_base=receivables,
        payables_base=-ledger.balance(db, Account.SUPPLIER_PAYABLE, as_of=end),
        collections_base=money(collections_base),
        payments_base=money(payments_base),
        closed_events_profit=closed_profit,
        general=general,
        month_result=money(closed_profit + general.total),
        partners=partners,
        events=event_lines,
        distribution_preview=[DistributionShare(**s) for s in preview_shares(db, general.total)],
    )


# --- Kapanış ---


def close_period(
    db: Session, month: str, *, actor: User, context: RequestContext
) -> AccountingPeriod:
    blockers = _blockers(db, month)
    if blockers:
        raise DomainError(" ".join(blockers))
    _, end = parse_month(month)
    general = general_result(db, month)
    entry, shares = post_distribution(
        db,
        amount=general.total,
        kind=EntryKind.PERIOD_CLOSE,
        entry_date=end,
        description=f"{month_label(end)} dönem kapanışı: genel gider ve kur farkı yansıtması",
        actor=actor,
    )
    db.flush()
    snapshot = preview(db, month).model_dump(mode="json")
    period = _period(db, month) or AccountingPeriod(month=month)
    period.status = PeriodStatus.CLOSED
    period.closed_at = clock.now()
    period.closed_by_id = actor.id
    period.entry_id = entry.id if entry else None
    period.snapshot = {**snapshot, "status": PeriodStatus.CLOSED.value, "closed_shares": shares}
    period.reopened_at = None
    period.reopen_reason = None
    db.add(period)
    audit.record(
        db,
        actor=actor,
        action="period.close",
        entity_type="period",
        entity_id=None,
        summary=(
            f"{month_label(end)} dönemi kapatıldı. "
            f"Genel sonuç {format_money(general.total)} ortaklara yansıtıldı."
        ),
        context=context,
    )
    db.commit()
    db.refresh(period)
    return period


def reopen_period(
    db: Session, month: str, reason: str, *, actor: User, context: RequestContext
) -> AccountingPeriod:
    period = _period(db, month)
    if period is None or period.status != PeriodStatus.CLOSED:
        raise NotFoundError("Kapalı dönem bulunamadı.")
    if not reason or len(reason.strip()) < 3:
        raise DomainError("Gerekçe yazın.")
    later = db.scalar(
        select(AccountingPeriod.month).where(
            AccountingPeriod.status == PeriodStatus.CLOSED, AccountingPeriod.month > month
        )
    )
    if later:
        raise DomainError(f"Önce sonraki kapalı dönem ({later}) açılmalıdır.")
    _, end = parse_month(month)
    period.status = PeriodStatus.OPEN
    db.flush()
    if period.entry_id:
        entry = db.get(JournalEntry, period.entry_id)
        ledger.reverse(
            db,
            entry,  # type: ignore[arg-type]
            entry_date=end,
            description=f"{month_label(end)} dönem kapanışı geri alındı. Gerekçe: {reason}",
            actor=actor,
        )
    period.snapshot = None
    period.entry_id = None
    period.reopened_at = clock.now()
    period.reopen_reason = reason
    audit.record(
        db,
        actor=actor,
        action="period.reopen",
        entity_type="period",
        entity_id=None,
        summary=f"{month_label(end)} dönemi yeniden açıldı. Gerekçe: {reason}",
        context=context,
    )
    db.commit()
    db.refresh(period)
    return period


def list_periods(db: Session) -> list[dict]:
    """Faaliyet olan ilk aydan bu aya kadar tüm dönemler ve durumları."""
    earliest = _earliest_activity_month(db) or month_of(clock.today())
    current = month_of(clock.today())
    periods = {p.month: p for p in db.scalars(select(AccountingPeriod))}
    result = []
    for month in reversed(months_range(min(earliest, current), current)):
        period = periods.get(month)
        start, _ = parse_month(month)
        result.append(
            {
                "month": month,
                "label": month_label(start),
                "status": period.status if period else PeriodStatus.OPEN,
                "closed_at": period.closed_at
                if period and period.status == PeriodStatus.CLOSED
                else None,
                "month_result": (period.snapshot or {}).get("month_result") if period else None,
            }
        )
    return result


def spread_months_closed(db: Session, expense: Expense) -> list[str]:
    months = list(recognized_shares(expense))
    return list(
        db.scalars(
            select(AccountingPeriod.month).where(
                AccountingPeriod.month.in_(months), AccountingPeriod.status == PeriodStatus.CLOSED
            )
        )
    )
