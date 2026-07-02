from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.expense import Expense, ExpenseAllocation
from app.models.user import User
from app.modules.expenses.schemas import (
    ExpenseAllocationRead,
    ExpenseCancelRequest,
    ExpenseCreate,
    ExpenseRead,
    ExpenseWithAllocationsRead,
    PeriodExpenseSummary,
)
from app.utils.money import D, money


def _to_float(value) -> float:
    if value is None:
        return D(0)

    return D(value)


def _round_money(value) -> float:
    return money(value)


def _period_month_from_date(value: date) -> str:
    return value.strftime("%Y-%m")


def _parse_period_month(period_month: str) -> tuple[int, int]:
    try:
        year_text, month_text = period_month.split("-")
        year = int(year_text)
        month = int(month_text)

        if month < 1 or month > 12:
            raise ValueError

        return year, month
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dönem formatı geçersiz. YYYY-MM formatı kullanılmalıdır. Örnek: 2026-06",
        )


def _month_range(start_month: str, end_month: str) -> list[str]:
    start_year, start_month_no = _parse_period_month(start_month)
    end_year, end_month_no = _parse_period_month(end_month)

    if (end_year, end_month_no) < (start_year, start_month_no):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dağıtım bitiş dönemi başlangıç döneminden önce olamaz.",
        )

    months: list[str] = []
    year = start_year
    month = start_month_no

    while (year, month) <= (end_year, end_month_no):
        months.append(f"{year}-{month:02d}")

        if month == 12:
            year += 1
            month = 1
        else:
            month += 1

    return months


def _default_allocation_end_month(expense_date: date) -> str:
    return f"{expense_date.year}-12"


def _build_allocation_amounts(base_amount: float, month_count: int) -> list[float]:
    if month_count <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dağıtım ay sayısı sıfır olamaz.",
        )

    base_amount = _round_money(base_amount)
    standard_amount = _round_money(base_amount / month_count)
    amounts: list[float] = []

    running_total = D(0)

    for index in range(month_count):
        if index == month_count - 1:
            amount = _round_money(base_amount - running_total)
        else:
            amount = standard_amount

        amounts.append(amount)
        running_total = _round_money(running_total + amount)

    return amounts


def _allocation_read(allocation: ExpenseAllocation, expense_title: str | None = None) -> ExpenseAllocationRead:
    return ExpenseAllocationRead(
        id=allocation.id,
        expense_id=allocation.expense_id,
        expense_title=expense_title,
        period_month=allocation.period_month,
        allocated_base_amount=_round_money(allocation.allocated_base_amount),
        notes=allocation.notes,
    )


def create_expense(
    db: Session,
    *,
    payload: ExpenseCreate,
    current_user: User,
) -> ExpenseWithAllocationsRead:
    expense_scope = payload.expense_scope.strip().lower()

    if expense_scope not in ("period", "season"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="expense_scope sadece period veya season olabilir.",
        )

    is_allocated = expense_scope == "season"
    allocation_start_month = _period_month_from_date(payload.expense_date) if is_allocated else None
    allocation_end_month = None

    if is_allocated:
        allocation_end_month = payload.allocation_end_month or _default_allocation_end_month(payload.expense_date)
        _parse_period_month(allocation_end_month)

    base_amount = _round_money(payload.amount * payload.exchange_rate)

    expense_type = payload.expense_type.strip().lower() if payload.expense_type else "general"

    if is_allocated and expense_type == "general":
        expense_type = "seasonal"

    expense = Expense(
        expense_type=expense_type,
        event_id=payload.event_id,
        artist_id=payload.artist_id,
        paid_by_partner_id=payload.paid_by_partner_id,
        paid_by_user_id=payload.paid_by_user_id or current_user.id,
        title=payload.title.strip(),
        description=payload.description,
        expense_date=payload.expense_date,
        amount=payload.amount,
        currency=payload.currency.upper(),
        exchange_rate=payload.exchange_rate,
        base_amount=base_amount,
        is_allocated=is_allocated,
        allocation_start_month=allocation_start_month,
        allocation_end_month=allocation_end_month,
        status="approved",
        document_no=payload.document_no,
        is_cancelled=False,
        cancellation_reason=None,
    )

    db.add(expense)
    db.flush()

    allocations: list[ExpenseAllocation] = []

    if is_allocated:
        months = _month_range(allocation_start_month, allocation_end_month)
        amounts = _build_allocation_amounts(base_amount=base_amount, month_count=len(months))

        for period_month, allocated_amount in zip(months, amounts):
            allocation = ExpenseAllocation(
                expense_id=expense.id,
                period_month=period_month,
                allocated_base_amount=allocated_amount,
                notes=(
                    f"Sezonluk gider dağıtımı: {allocation_start_month} - {allocation_end_month}. "
                    f"Toplam {base_amount:.4f} {expense.currency}, ay sayısı {len(months)}."
                ),
            )
            db.add(allocation)
            allocations.append(allocation)

    db.commit()
    db.refresh(expense)

    for allocation in allocations:
        db.refresh(allocation)

    return ExpenseWithAllocationsRead(
        expense=ExpenseRead.model_validate(expense),
        allocations=[_allocation_read(allocation, expense.title) for allocation in allocations],
    )


def get_expense(
    db: Session,
    *,
    expense_id: int,
) -> ExpenseWithAllocationsRead:
    expense = db.get(Expense, expense_id)

    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gider bulunamadı.",
        )

    allocations = (
        db.query(ExpenseAllocation)
        .filter(ExpenseAllocation.expense_id == expense.id)
        .order_by(ExpenseAllocation.period_month.asc())
        .all()
    )

    return ExpenseWithAllocationsRead(
        expense=ExpenseRead.model_validate(expense),
        allocations=[_allocation_read(allocation, expense.title) for allocation in allocations],
    )


def list_expenses(
    db: Session,
    *,
    period_month: str | None = None,
    expense_scope: str | None = None,
) -> list[ExpenseRead]:
    query = db.query(Expense).filter(Expense.is_cancelled == False)  # noqa: E712

    if period_month is not None:
        start_year, start_month_no = _parse_period_month(period_month)
        start_date = date(start_year, start_month_no, 1)

        if start_month_no == 12:
            end_date = date(start_year + 1, 1, 1)
        else:
            end_date = date(start_year, start_month_no + 1, 1)

        query = query.filter(
            Expense.expense_date >= start_date,
            Expense.expense_date < end_date,
        )

    if expense_scope is not None:
        scope = expense_scope.strip().lower()

        if scope == "season":
            query = query.filter(Expense.is_allocated == True)  # noqa: E712
        elif scope == "period":
            query = query.filter(Expense.is_allocated == False)  # noqa: E712
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="expense_scope sadece period veya season olabilir.",
            )

    items = query.order_by(Expense.expense_date.desc(), Expense.id.desc()).all()

    return [ExpenseRead.model_validate(item) for item in items]


def list_expense_allocations(
    db: Session,
    *,
    expense_id: int,
) -> list[ExpenseAllocationRead]:
    expense = db.get(Expense, expense_id)

    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gider bulunamadı.",
        )

    allocations = (
        db.query(ExpenseAllocation)
        .filter(ExpenseAllocation.expense_id == expense_id)
        .order_by(ExpenseAllocation.period_month.asc())
        .all()
    )

    return [_allocation_read(allocation, expense.title) for allocation in allocations]


def list_period_allocations(
    db: Session,
    *,
    period_month: str,
) -> list[ExpenseAllocationRead]:
    _parse_period_month(period_month)

    rows = (
        db.query(ExpenseAllocation, Expense.title)
        .join(Expense, Expense.id == ExpenseAllocation.expense_id)
        .filter(
            ExpenseAllocation.period_month == period_month,
            Expense.is_cancelled == False,  # noqa: E712
        )
        .order_by(ExpenseAllocation.id.asc())
        .all()
    )

    return [_allocation_read(allocation, title) for allocation, title in rows]


def get_period_expense_summary(
    db: Session,
    *,
    period_month: str,
) -> PeriodExpenseSummary:
    year, month = _parse_period_month(period_month)
    start_date = date(year, month, 1)

    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    direct_general_value = (
        db.query(func.coalesce(func.sum(Expense.base_amount), 0))
        .filter(
            Expense.event_id.is_(None),
            Expense.is_allocated == False,  # noqa: E712
            Expense.is_cancelled == False,  # noqa: E712
            Expense.expense_date >= start_date,
            Expense.expense_date < end_date,
        )
        .scalar()
    )

    direct_count = (
        db.query(Expense)
        .filter(
            Expense.event_id.is_(None),
            Expense.is_allocated == False,  # noqa: E712
            Expense.is_cancelled == False,  # noqa: E712
            Expense.expense_date >= start_date,
            Expense.expense_date < end_date,
        )
        .count()
    )

    allocation_rows = list_period_allocations(db=db, period_month=period_month)
    allocated_value = _round_money(sum(item.allocated_base_amount for item in allocation_rows))

    return PeriodExpenseSummary(
        period_month=period_month,
        direct_general_expense_base_amount=_round_money(direct_general_value),
        allocated_expense_base_amount=allocated_value,
        total_period_expense_base_amount=_round_money(_to_float(direct_general_value) + allocated_value),
        allocation_count=len(allocation_rows),
        direct_expense_count=direct_count,
    )


def cancel_expense(
    db: Session,
    *,
    expense_id: int,
    payload: ExpenseCancelRequest,
) -> ExpenseRead:
    expense = db.get(Expense, expense_id)

    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gider bulunamadı.",
        )

    if expense.is_cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu gider zaten iptal edilmiş.",
        )

    expense.is_cancelled = True
    expense.status = "cancelled"
    expense.cancellation_reason = payload.cancellation_reason.strip()

    db.commit()
    db.refresh(expense)

    return ExpenseRead.model_validate(expense)
