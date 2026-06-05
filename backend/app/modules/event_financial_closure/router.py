from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.event_financial_closure.schemas import (
    EventFinancialClosureApproveRequest,
    EventFinancialClosureChecklistResponse,
    EventFinancialClosurePrepareRequest,
    EventFinancialClosureRead,
    EventFinancialClosureReopenRequest,
)
from app.modules.event_financial_closure.services import (
    approve_event_financial_closure,
    calculate_event_financial_closure_snapshot,
    get_latest_event_financial_closure,
    prepare_event_financial_closure,
    reopen_event_financial_closure,
)

router = APIRouter(prefix="/events/{event_id}/financial-closure", tags=["Event Financial Closure"])


@router.get("/checklist", response_model=EventFinancialClosureChecklistResponse)
def get_financial_closure_checklist(
    event_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return calculate_event_financial_closure_snapshot(
        db=db,
        event_id=event_id,
    )


@router.get("/latest", response_model=EventFinancialClosureRead | None)
def get_latest_closure(
    event_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return get_latest_event_financial_closure(
        db=db,
        event_id=event_id,
    )


@router.post("/prepare", response_model=EventFinancialClosureRead, status_code=status.HTTP_201_CREATED)
def prepare_closure(
    event_id: int,
    payload: EventFinancialClosurePrepareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return prepare_event_financial_closure(
        db=db,
        event_id=event_id,
        payload=payload,
        current_user=current_user,
    )


@router.post("/approve", response_model=EventFinancialClosureRead)
def approve_closure(
    event_id: int,
    payload: EventFinancialClosureApproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return approve_event_financial_closure(
        db=db,
        event_id=event_id,
        payload=payload,
        current_user=current_user,
    )


@router.post("/reopen", response_model=EventFinancialClosureRead)
def reopen_closure(
    event_id: int,
    payload: EventFinancialClosureReopenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return reopen_event_financial_closure(
        db=db,
        event_id=event_id,
        payload=payload,
        current_user=current_user,
    )
