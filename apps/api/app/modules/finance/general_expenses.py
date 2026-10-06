"""Genel giderler (etkinliğe bağlı olmayan şirket giderleri): ay görünümü, aylara bölünen
giderlerin takvimi ve sezon boyunca aylık dağılım."""

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.money import ZERO, money
from app.core.schemas import ApiModel
from app.modules.closing import periods
from app.modules.closing.models import AccountingPeriod, PeriodStatus
from app.modules.closing.service import month_label
from app.modules.finance.models import DocStatus, Expense, ExpenseAllocation, ExpenseCategory
from app.modules.settings.router import get_company_settings

PAID_BY = {
    "company": "Kasadan / bankadan",
    "partner": "Ortak cebinden",
    "unpaid": "Ödenmedi (borç)",
}


class GeneralExpenseLine(ApiModel):
    id: int
    expense_no: str
    expense_date: date
    category: ExpenseCategory
    title: str
    amount: Decimal
    currency: str
    base: Decimal
    paid_by: str
    paid_by_label: str
    payer: str | None


class SpreadLine(ApiModel):
    id: int
    expense_no: str
    expense_date: date
    category: ExpenseCategory
    title: str
    allocation: ExpenseAllocation
    spread_from: str
    spread_until: str
    months: int
    total_base: Decimal
    monthly_share: Decimal
    this_month: Decimal
    recognized_to_date: Decimal
    remaining: Decimal


class CategoryTotal(ApiModel):
    category: ExpenseCategory
    total: Decimal


class SeasonMonth(ApiModel):
    month: str
    label: str
    direct: Decimal
    spread: Decimal
    total: Decimal
    closed: bool


class GeneralExpenses(ApiModel):
    month: str
    label: str
    closed: bool
    season_first: str
    season_last: str
    season_label: str
    season_start_month: int
    direct: list[GeneralExpenseLine]
    spread: list[SpreadLine]
    direct_total: Decimal
    spread_total: Decimal
    month_total: Decimal
    categories: list[CategoryTotal]
    season: list[SeasonMonth]
    season_total: Decimal


def _label(month: str) -> str:
    return month_label(periods.parse_month(month)[0])


def general_expenses(db: Session, month: str) -> GeneralExpenses:
    start, end = periods.parse_month(month)
    start_month = get_company_settings(db).season_start_month
    first, last = periods.season_bounds(month, start_month)
    closed_months = set(
        db.scalars(
            select(AccountingPeriod.month).where(AccountingPeriod.status == PeriodStatus.CLOSED)
        )
    )

    direct = []
    for e in db.scalars(
        select(Expense)
        .where(
            Expense.status == DocStatus.ACTIVE,
            Expense.event_id.is_(None),
            Expense.spread_until.is_(None),
            Expense.expense_date >= start,
            Expense.expense_date <= end,
        )
        .order_by(Expense.expense_date, Expense.id)
    ):
        payer = (
            e.partner.full_name
            if e.partner
            else e.cash_account.name
            if e.cash_account
            else e.supplier.name
            if e.supplier
            else None
        )
        direct.append(
            GeneralExpenseLine(
                id=e.id,
                expense_no=e.expense_no,
                expense_date=e.expense_date,
                category=e.category,
                title=e.title,
                amount=e.amount,
                currency=e.currency,
                base=money(e.amount * e.rate),
                paid_by=e.paid_by,
                paid_by_label=PAID_BY.get(e.paid_by, e.paid_by),
                payer=payer,
            )
        )

    spread = []
    for e in db.scalars(
        select(Expense)
        .where(
            Expense.status == DocStatus.ACTIVE,
            Expense.event_id.is_(None),
            Expense.spread_until.is_not(None),
        )
        .order_by(Expense.expense_date, Expense.id)
    ):
        shares = periods.recognized_shares(e)
        months = periods.spread_months(e)
        if not (months[0] <= month <= months[-1]) and month not in shares:
            continue
        total = money(e.amount * e.rate)
        to_date = money(sum((v for k, v in shares.items() if k <= month), ZERO))
        spread.append(
            SpreadLine(
                id=e.id,
                expense_no=e.expense_no,
                expense_date=e.expense_date,
                category=e.category,
                title=e.title,
                allocation=e.allocation,
                spread_from=months[0],
                spread_until=months[-1],
                months=len(months),
                total_base=total,
                monthly_share=money(total / len(months)),
                this_month=shares.get(month, ZERO),
                recognized_to_date=to_date,
                remaining=money(total - to_date),
            )
        )

    direct_total = money(sum((d.base for d in direct), ZERO))
    spread_total = money(sum((s.this_month for s in spread), ZERO))
    categories: dict[ExpenseCategory, Decimal] = {}
    for d in direct:
        categories[d.category] = categories.get(d.category, ZERO) + d.base
    for s in spread:
        if s.this_month:
            categories[s.category] = categories.get(s.category, ZERO) + s.this_month

    season = []
    for m in periods.months_range(first, last):
        result = periods.general_result(db, m)
        season.append(
            SeasonMonth(
                month=m,
                label=_label(m),
                direct=money(result.direct_expenses),
                spread=result.spread_expenses,
                total=money(result.direct_expenses + result.spread_expenses),
                closed=m in closed_months,
            )
        )

    return GeneralExpenses(
        month=month,
        label=_label(month),
        closed=month in closed_months,
        season_first=first,
        season_last=last,
        season_label=f"{_label(first)} – {_label(last)}",
        season_start_month=start_month,
        direct=direct,
        spread=spread,
        direct_total=direct_total,
        spread_total=spread_total,
        month_total=money(direct_total + spread_total),
        categories=sorted(
            (CategoryTotal(category=k, total=money(v)) for k, v in categories.items()),
            key=lambda c: -c.total,
        ),
        season=season,
        season_total=money(sum((s.total for s in season), ZERO)),
    )
