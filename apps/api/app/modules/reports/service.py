"""Yönetim raporları. Tüm tutarlar TL karşılığıdır ve muhasebe kayıtlarından hesaplanır;
böylece raporlar, kapanış ve cari ekstreler aynı rakamı gösterir."""

from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.money import ZERO, money
from app.core.schemas import ApiModel
from app.modules.catalog.models import Artist
from app.modules.closing.models import ClosureStatus, EventClosure
from app.modules.closing.periods import general_result, month_of, months_range, parse_month
from app.modules.closing.service import month_label
from app.modules.customers.models import Customer
from app.modules.events.models import Event, EventItem, EventStatus
from app.modules.finance.models import Account, Collection, DocStatus, JournalLine
from app.modules.offers.models import LineType
from app.modules.offers.schemas import Ref
from app.modules.offers.service import cost_total_base, line_total

RESULT_ACCOUNTS = (
    Account.REVENUE,
    Account.EVENT_COST,
    Account.EXPENSE,
    Account.FX_DIFFERENCE,
    Account.CUSTOMER_RECEIVABLE,
)


# --- Şemalar ---


class EventResult(ApiModel):
    revenue: Decimal
    cost: Decimal
    expense: Decimal
    fx: Decimal
    profit: Decimal


class EventReportRow(EventResult):
    event_id: int
    event_no: str
    title: str
    customer: Ref
    partner: Ref
    event_date: date
    status: EventStatus
    closed: bool
    margin: Decimal | None
    receivable: Decimal


class EventReport(ApiModel):
    rows: list[EventReportRow]
    totals: EventResult
    receivable: Decimal


class MonthRow(ApiModel):
    month: str
    label: str
    event_count: int
    revenue: Decimal
    event_cost: Decimal
    event_profit: Decimal
    general: Decimal
    net: Decimal
    collections: Decimal


class MonthlyReport(ApiModel):
    rows: list[MonthRow]
    totals: MonthRow


class ArtistRow(ApiModel):
    artist: Ref
    event_count: int
    sales: Decimal
    cost: Decimal
    margin: Decimal


class CustomerRow(ApiModel):
    customer: Ref
    event_count: int
    revenue: Decimal
    profit: Decimal
    collected: Decimal
    receivable: Decimal


# --- Ortak ---


def _margin(profit: Decimal, revenue: Decimal) -> Decimal | None:
    return money(profit / revenue * 100) if revenue else None


def event_results(db: Session, event_ids: list[int]) -> dict[int, dict[str, Decimal]]:
    """Etkinlik bazında gelir, maliyet, gider, kur farkı, kâr ve açık alacak (tek sorgu)."""
    sums: dict[int, dict[str, Decimal]] = defaultdict(lambda: defaultdict(lambda: ZERO))
    if event_ids:
        rows = db.execute(
            select(
                JournalLine.event_id,
                JournalLine.account,
                func.sum(JournalLine.debit - JournalLine.credit),
            )
            .where(JournalLine.event_id.in_(event_ids), JournalLine.account.in_(RESULT_ACCOUNTS))
            .group_by(JournalLine.event_id, JournalLine.account)
        )
        for event_id, account, total in rows:
            sums[event_id][account] = total
    result = {}
    for event_id in event_ids:
        s = sums[event_id]
        revenue = money(-s[Account.REVENUE])
        cost = money(s[Account.EVENT_COST])
        expense = money(s[Account.EXPENSE])
        fx = money(-s[Account.FX_DIFFERENCE])
        result[event_id] = {
            "revenue": revenue,
            "cost": cost,
            "expense": expense,
            "fx": fx,
            "profit": money(revenue - cost - expense + fx),
            "receivable": money(s[Account.CUSTOMER_RECEIVABLE]),
        }
    return result


def _events_between(db: Session, date_from: date, date_to: date) -> list[Event]:
    return list(
        db.scalars(
            select(Event)
            .where(
                Event.status != EventStatus.CANCELLED,
                Event.event_date >= date_from,
                Event.event_date <= date_to,
            )
            .order_by(Event.event_date, Event.id)
        )
    )


# --- Raporlar ---


def event_report(
    db: Session, *, date_from: date, date_to: date, partner_id: int | None
) -> EventReport:
    events = [
        e
        for e in _events_between(db, date_from, date_to)
        if partner_id is None or e.partner_id == partner_id
    ]
    results = event_results(db, [e.id for e in events])
    closed = set(
        db.scalars(
            select(EventClosure.event_id).where(
                EventClosure.event_id.in_([e.id for e in events]),
                EventClosure.status == ClosureStatus.CLOSED,
            )
        )
    )
    rows = []
    for e in events:
        r = results[e.id]
        rows.append(
            EventReportRow(
                event_id=e.id,
                event_no=e.event_no,
                title=e.title,
                customer=Ref(id=e.customer.id, name=e.customer.name),
                partner=Ref(id=e.partner.id, name=e.partner.full_name),
                event_date=e.event_date,
                status=e.status,
                closed=e.id in closed,
                margin=_margin(r["profit"], r["revenue"]),
                **r,
            )
        )
    keys = ("revenue", "cost", "expense", "fx", "profit")
    totals = {k: money(sum((getattr(row, k) for row in rows), ZERO)) for k in keys}
    return EventReport(
        rows=rows,
        totals=EventResult(**totals),
        receivable=money(sum((row.receivable for row in rows), ZERO)),
    )


def monthly_report(db: Session, *, first: str, last: str) -> MonthlyReport:
    """Etkinlik sonuçları etkinliğin yapıldığı aya, genel giderler kayıt ayına yazılır."""
    months = months_range(first, last)
    start, _ = parse_month(months[0])
    _, end = parse_month(months[-1])
    events = _events_between(db, start, end)
    results = event_results(db, [e.id for e in events])
    by_month: dict[str, list[Event]] = defaultdict(list)
    for e in events:
        by_month[month_of(e.event_date)].append(e)

    collected: dict[str, Decimal] = defaultdict(lambda: ZERO)
    for day, total in db.execute(
        select(Collection.collection_date, func.sum(Collection.amount * Collection.rate))
        .where(
            Collection.status == DocStatus.ACTIVE,
            Collection.collection_date >= start,
            Collection.collection_date <= end,
        )
        .group_by(Collection.collection_date)
    ):
        collected[month_of(day)] += total

    rows = []
    for month in months:
        month_events = by_month[month]
        revenue = money(sum((results[e.id]["revenue"] for e in month_events), ZERO))
        profit = money(sum((results[e.id]["profit"] for e in month_events), ZERO))
        general = general_result(db, month).total
        rows.append(
            MonthRow(
                month=month,
                label=month_label(parse_month(month)[0]),
                event_count=len(month_events),
                revenue=revenue,
                event_cost=money(revenue - profit),
                event_profit=profit,
                general=general,
                net=money(profit + general),
                collections=money(collected[month]),
            )
        )

    def total(key: str) -> Decimal:
        return money(sum((getattr(r, key) for r in rows), ZERO))

    return MonthlyReport(
        rows=rows,
        totals=MonthRow(
            month="",
            label="Toplam",
            event_count=sum(r.event_count for r in rows),
            revenue=total("revenue"),
            event_cost=total("event_cost"),
            event_profit=total("event_profit"),
            general=total("general"),
            net=total("net"),
            collections=total("collections"),
        ),
    )


def artist_report(db: Session, *, date_from: date, date_to: date) -> list[ArtistRow]:
    """Anlaşma bazında sanatçı satış ve maliyeti. Paket fiyatı, içindeki kalemlere
    maliyetleri oranında dağıtılır (maliyet yoksa eşit)."""
    events = _events_between(db, date_from, date_to)
    sales: dict[int, Decimal] = defaultdict(lambda: ZERO)
    costs: dict[int, Decimal] = defaultdict(lambda: ZERO)
    seen: dict[int, set[int]] = defaultdict(set)
    for event in events:
        children: dict[int, list[EventItem]] = defaultdict(list)
        for item in event.items:
            if item.parent_id:
                children[item.parent_id].append(item)
        for item in event.items:
            if item.line_type == LineType.ARTIST and item.artist_id:
                parts = [(item, line_total(item) * event.exchange_rate)]
            elif item.line_type == LineType.PACKAGE:
                parts = _allocate(children[item.id], line_total(item) * event.exchange_rate)
            else:
                continue
            for part, sale in parts:
                if not part.artist_id:
                    continue
                sales[part.artist_id] += sale
                costs[part.artist_id] += cost_total_base(part)
                seen[part.artist_id].add(event.id)
    names = dict(db.execute(select(Artist.id, Artist.name).where(Artist.id.in_(list(seen)))).all())
    rows = [
        ArtistRow(
            artist=Ref(id=artist_id, name=names[artist_id]),
            event_count=len(event_ids),
            sales=money(sales[artist_id]),
            cost=money(costs[artist_id]),
            margin=money(sales[artist_id] - costs[artist_id]),
        )
        for artist_id, event_ids in seen.items()
    ]
    return sorted(rows, key=lambda r: (-r.event_count, -r.sales, r.artist.name))


def _allocate(components: list[EventItem], price: Decimal) -> list[tuple[EventItem, Decimal]]:
    if not components:
        return []
    weights = [cost_total_base(c) for c in components]
    total = sum(weights, ZERO)
    if total <= 0:
        weights, total = [Decimal(1)] * len(components), Decimal(len(components))
    return [(c, price * w / total) for c, w in zip(components, weights, strict=True)]


def customer_report(db: Session, *, date_from: date, date_to: date) -> list[CustomerRow]:
    events = _events_between(db, date_from, date_to)
    results = event_results(db, [e.id for e in events])
    collected = dict(
        db.execute(
            select(Collection.event_id, func.sum(Collection.amount * Collection.rate))
            .where(
                Collection.status == DocStatus.ACTIVE,
                Collection.event_id.in_([e.id for e in events]),
            )
            .group_by(Collection.event_id)
        ).all()
    )
    grouped: dict[int, list[Event]] = defaultdict(list)
    for e in events:
        grouped[e.customer_id].append(e)
    rows = []
    for customer_id, items in grouped.items():
        customer: Customer = items[0].customer
        rows.append(
            CustomerRow(
                customer=Ref(id=customer_id, name=customer.name),
                event_count=len(items),
                revenue=money(sum((results[e.id]["revenue"] for e in items), ZERO)),
                profit=money(sum((results[e.id]["profit"] for e in items), ZERO)),
                collected=money(sum((collected.get(e.id, ZERO) for e in items), ZERO)),
                receivable=money(sum((results[e.id]["receivable"] for e in items), ZERO)),
            )
        )
    return sorted(rows, key=lambda r: (-r.revenue, r.customer.name))


def default_months(count: int = 12) -> tuple[str, str]:
    today = clock.today()
    last = month_of(today)
    year, mon = today.year, today.month - (count - 1)
    while mon < 1:
        mon += 12
        year -= 1
    return f"{year:04d}-{mon:02d}", last
