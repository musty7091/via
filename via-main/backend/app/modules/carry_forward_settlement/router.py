from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.carry_forward_settlement.schemas import (
    CarryForwardItemDetail,
    CarryForwardSettlementRequest,
    CarryForwardSettlementResponse,
)
from app.modules.carry_forward_settlement.services import (
    get_carry_forward_item,
    list_open_carry_forward_items,
    settle_carry_forward_item,
)

router = APIRouter(prefix="/carry-forwards", tags=["Carry Forward Settlement"])


@router.get("/open", response_model=list[CarryForwardItemDetail])
def get_open_carry_forwards(
    target_period_month: str | None = None,
    source_period_month: str | None = None,
    carry_type: str | None = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return list_open_carry_forward_items(
        db=db,
        target_period_month=target_period_month,
        source_period_month=source_period_month,
        carry_type=carry_type,
    )


@router.get("/{item_id}", response_model=CarryForwardItemDetail)
def get_carry_forward_detail(
    item_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return get_carry_forward_item(
        db=db,
        item_id=item_id,
    )


@router.post("/{item_id}/settle", response_model=CarryForwardSettlementResponse)
def settle_carry_forward(
    item_id: int,
    payload: CarryForwardSettlementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return settle_carry_forward_item(
        db=db,
        item_id=item_id,
        payload=payload,
        current_user=current_user,
    )
