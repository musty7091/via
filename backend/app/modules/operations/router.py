from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.operations import services
from app.modules.operations.schemas import (
    GenerateResult,
    RiderCheckBoard,
    RiderCheckCreate,
    RiderCheckRead,
    RiderCheckUpdate,
)

router = APIRouter(prefix="/operations", tags=["Operations / Rider"])


@router.get("/events/{event_id}/rider-checks", response_model=RiderCheckBoard)
def get_rider_board(
    event_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Bir etkinliğin saha/rider kontrol panosunu döndürür."""
    return services.build_board(db=db, event_id=event_id)


@router.post(
    "/events/{event_id}/rider-checks/generate",
    response_model=GenerateResult,
)
def generate_rider_checks(
    event_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Etkinlikteki sanatçıların rider şablonlarından kontrol listesi üretir."""
    created, skipped = services.generate_from_artists(db=db, event_id=event_id)
    board = services.build_board(db=db, event_id=event_id)
    return GenerateResult(
        created_count=created,
        skipped_count=skipped,
        board=board,
    )


@router.post(
    "/events/{event_id}/rider-checks",
    response_model=RiderCheckRead,
    status_code=status.HTTP_201_CREATED,
)
def create_rider_check(
    event_id: int,
    payload: RiderCheckCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Listeye elle yeni bir saha kontrol maddesi ekler."""
    return services.add_manual_check(db=db, event_id=event_id, payload=payload)


@router.patch("/rider-checks/{check_id}", response_model=RiderCheckRead)
def update_rider_check(
    check_id: int,
    payload: RiderCheckUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bir maddenin durumunu (tamam/sorunlu/bekliyor) ve notunu günceller."""
    return services.update_check(
        db=db, check_id=check_id, payload=payload, current_user=current_user
    )


@router.delete("/rider-checks/{check_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rider_check(
    check_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Bir kontrol maddesini siler."""
    services.delete_check(db=db, check_id=check_id)
    return None
