from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.expenses.schemas import (
    ExpenseAllocationRead,
    ExpenseCancelRequest,
    ExpenseCreate,
    ExpenseRead,
    ExpenseWithAllocationsRead,
    PeriodExpenseSummary,
)
from app.modules.expenses.services import (
    cancel_expense,
    create_expense,
    get_expense,
    get_period_expense_summary,
    list_expense_allocations,
    list_expenses,
    list_period_allocations,
)

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.post("", response_model=ExpenseWithAllocationsRead, status_code=status.HTTP_201_CREATED)
def create_expense_record(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_expense(
        db=db,
        payload=payload,
        current_user=current_user,
    )


@router.get("", response_model=list[ExpenseRead])
def get_expenses(
    period_month: str | None = None,
    expense_scope: str | None = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return list_expenses(
        db=db,
        period_month=period_month,
        expense_scope=expense_scope,
    )


@router.get("/period-summary/{period_month}", response_model=PeriodExpenseSummary)
def get_period_summary(
    period_month: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return get_period_expense_summary(
        db=db,
        period_month=period_month,
    )


@router.get("/allocations/{period_month}", response_model=list[ExpenseAllocationRead])
def get_period_allocations(
    period_month: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return list_period_allocations(
        db=db,
        period_month=period_month,
    )


@router.get("/{expense_id}", response_model=ExpenseWithAllocationsRead)
def get_expense_detail(
    expense_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return get_expense(
        db=db,
        expense_id=expense_id,
    )


@router.get("/{expense_id}/allocations", response_model=list[ExpenseAllocationRead])
def get_expense_allocation_list(
    expense_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return list_expense_allocations(
        db=db,
        expense_id=expense_id,
    )


@router.post("/{expense_id}/cancel", response_model=ExpenseRead)
def cancel_expense_record(
    expense_id: int,
    payload: ExpenseCancelRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return cancel_expense(
        db=db,
        expense_id=expense_id,
        payload=payload,
    )
