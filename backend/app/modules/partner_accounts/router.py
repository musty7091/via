from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.partner_accounts.schemas import (
    PartnerAccountBalancesResponse,
    PartnerAccountStatementResponse,
)
from app.modules.partner_accounts.services import (
    get_partner_account_balances,
    get_partner_account_statement,
)

router = APIRouter(prefix="/partner-accounts", tags=["Partner Accounts"])


@router.get("/balances", response_model=PartnerAccountBalancesResponse)
def get_partner_balances(
    event_id: int | None = None,
    only_with_balance: bool = False,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return get_partner_account_balances(
        db=db,
        event_id=event_id,
        only_with_balance=only_with_balance,
        include_inactive=include_inactive,
    )


@router.get("/{partner_id}/statement", response_model=PartnerAccountStatementResponse)
def get_partner_statement(
    partner_id: int,
    event_id: int | None = None,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return get_partner_account_statement(
        db=db,
        partner_id=partner_id,
        event_id=event_id,
        date_from=date_from,
        date_to=date_to,
    )
