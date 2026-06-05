from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.period_closing.schemas import (
    CarryForwardItemRead,
    PeriodCloseRequest,
    PeriodCloseResponse,
    PeriodClosingPreviewResponse,
)
from app.modules.period_closing.services import (
    build_period_closing_preview,
    close_period,
    list_carry_forward_items,
)

router = APIRouter(prefix="/period-closing", tags=["Period Closing"])


@router.get("/{period_month}/preview", response_model=PeriodClosingPreviewResponse)
def get_period_closing_preview(
    period_month: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return build_period_closing_preview(
        db=db,
        period_month=period_month,
    )


@router.get("/{period_month}/carry-forwards", response_model=list[CarryForwardItemRead])
def get_period_carry_forwards(
    period_month: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return list_carry_forward_items(
        db=db,
        period_month=period_month,
    )


@router.post("/{period_month}/close", response_model=PeriodCloseResponse, status_code=status.HTTP_201_CREATED)
def close_monthly_period(
    period_month: str,
    payload: PeriodCloseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return close_period(
        db=db,
        period_month=period_month,
        payload=payload,
        current_user=current_user,
    )
