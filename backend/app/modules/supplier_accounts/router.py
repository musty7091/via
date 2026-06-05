from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.supplier_accounts.schemas import SupplierAccountStatementResponse
from app.modules.supplier_accounts.services import get_supplier_account_statement

router = APIRouter(prefix="/supplier-accounts", tags=["Supplier Accounts"])


@router.get("/artists/{artist_id}/statement", response_model=SupplierAccountStatementResponse)
def get_artist_statement(
    artist_id: int,
    event_id: int | None = None,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    include_cancelled: bool = True,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return get_supplier_account_statement(
        db=db,
        supplier_kind="artist",
        supplier_id=artist_id,
        event_id=event_id,
        date_from=date_from,
        date_to=date_to,
        include_cancelled=include_cancelled,
    )


@router.get("/services/{service_item_id}/statement", response_model=SupplierAccountStatementResponse)
def get_service_statement(
    service_item_id: int,
    event_id: int | None = None,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    include_cancelled: bool = True,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return get_supplier_account_statement(
        db=db,
        supplier_kind="service",
        supplier_id=service_item_id,
        event_id=event_id,
        date_from=date_from,
        date_to=date_to,
        include_cancelled=include_cancelled,
    )
