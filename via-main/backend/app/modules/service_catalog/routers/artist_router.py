from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.modules.service_catalog.schemas.artist import (
    ArtistCreate,
    ArtistRead,
    ArtistRiderTemplateItemCreate,
    ArtistRiderTemplateItemRead,
    ArtistUpdate,
)
from app.modules.service_catalog.services import artist_service

router = APIRouter(prefix="/service-catalog/artists", tags=["Service Catalog - Artist Services"])


@router.get("", response_model=list[ArtistRead])
def list_artists(
    search: str | None = Query(default=None),
    artist_type: str | None = Query(default=None),
    is_active: bool | None = Query(default=True),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return artist_service.list_artists(
        db=db,
        search=search,
        artist_type=artist_type,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=ArtistRead, status_code=status.HTTP_201_CREATED)
def create_artist(
    payload: ArtistCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return artist_service.create_artist(db=db, payload=payload)


@router.get("/{artist_id}", response_model=ArtistRead)
def get_artist(
    artist_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return artist_service.get_artist_or_404(db=db, artist_id=artist_id)


@router.put("/{artist_id}", response_model=ArtistRead)
def update_artist(
    artist_id: int,
    payload: ArtistUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return artist_service.update_artist(db=db, artist_id=artist_id, payload=payload)


@router.get("/{artist_id}/rider", response_model=list[ArtistRiderTemplateItemRead])
def list_rider_items(
    artist_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return artist_service.list_rider_items(db=db, artist_id=artist_id)


@router.post("/{artist_id}/rider", response_model=ArtistRiderTemplateItemRead, status_code=status.HTTP_201_CREATED)
def create_rider_item(
    artist_id: int,
    payload: ArtistRiderTemplateItemCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return artist_service.create_rider_item(db=db, artist_id=artist_id, payload=payload)
