from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.finance_center.schemas import (
    CashAccountRead,
    FinancialMovementListResponse,
    FinancialMovementRead,
    FinancialMovementSummaryResponse,
)
from app.modules.finance_center.services import (
    get_financial_movements_summary,
    list_cash_accounts,
    list_financial_movements,
)

router = APIRouter(prefix="/finance", tags=["Finance Center"])

@router.get("/cash-accounts", response_model=list[CashAccountRead])
def get_cash_accounts(
    is_active: bool | None = True,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return [
        CashAccountRead.model_validate(item)
        for item in list_cash_accounts(
            db=db,
            is_active=is_active,
        )
    ]


@router.get("/movements", response_model=FinancialMovementListResponse)
def get_financial_movements(
    event_id: int | None = None,
    customer_id: int | None = None,
    partner_id: int | None = None,
    period_month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    source_type: str | None = None,
    movement_type: str | None = None,
    account_area: str | None = None,
    status: str | None = None,
    include_cancelled: bool = False,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    total_count, items = list_financial_movements(
        db=db,
        event_id=event_id,
        customer_id=customer_id,
        partner_id=partner_id,
        period_month=period_month,
        source_type=source_type,
        movement_type=movement_type,
        account_area=account_area,
        status=status,
        include_cancelled=include_cancelled,
        skip=skip,
        limit=limit,
    )

    return FinancialMovementListResponse(
        total_count=total_count,
        items=[FinancialMovementRead.model_validate(item) for item in items],
    )


@router.get("/movements/summary", response_model=FinancialMovementSummaryResponse)
def get_financial_movements_summary_view(
    event_id: int | None = None,
    customer_id: int | None = None,
    partner_id: int | None = None,
    period_month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    source_type: str | None = None,
    movement_type: str | None = None,
    account_area: str | None = None,
    status: str | None = None,
    include_cancelled: bool = False,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return get_financial_movements_summary(
        db=db,
        event_id=event_id,
        customer_id=customer_id,
        partner_id=partner_id,
        period_month=period_month,
        source_type=source_type,
        movement_type=movement_type,
        account_area=account_area,
        status=status,
        include_cancelled=include_cancelled,
    )
