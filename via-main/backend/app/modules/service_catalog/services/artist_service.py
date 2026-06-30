from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.artist import Artist
from app.models.partner import Partner
from app.modules.service_catalog import constants
from app.modules.service_catalog.repositories import artist_repository
from app.modules.service_catalog.schemas.artist import (
    ArtistCreate,
    ArtistRiderTemplateItemCreate,
    ArtistUpdate,
)


def _validate_choice(field_name: str, value: str | None, allowed_values: list[str]) -> None:
    if value is None:
        return

    if value not in allowed_values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} geçersiz. Geçerli değerler: {', '.join(allowed_values)}",
        )


def _validate_partner(db: Session, partner_id: int | None) -> None:
    if partner_id is None:
        return

    if db.get(Partner, partner_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sorumlu ortak bulunamadı.",
        )


def get_artist_or_404(db: Session, artist_id: int) -> Artist:
    artist = artist_repository.get_artist(db=db, artist_id=artist_id)

    if artist is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sanatçı hizmeti bulunamadı.",
        )

    return artist


def list_artists(
    db: Session,
    search: str | None = None,
    artist_type: str | None = None,
    is_active: bool | None = True,
    skip: int = 0,
    limit: int = 100,
):
    return artist_repository.list_artists(
        db=db,
        search=search,
        artist_type=artist_type,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )


def create_artist(db: Session, payload: ArtistCreate):
    _validate_choice("artist_type", payload.artist_type, constants.ARTIST_TYPES)
    _validate_choice("default_cost_currency", payload.default_cost_currency, constants.CURRENCIES)
    _validate_choice("default_sale_currency", payload.default_sale_currency, constants.CURRENCIES)
    _validate_partner(db=db, partner_id=payload.manager_partner_id)

    return artist_repository.create_artist(db=db, data=payload.model_dump())


def update_artist(db: Session, artist_id: int, payload: ArtistUpdate):
    artist = get_artist_or_404(db=db, artist_id=artist_id)
    data = payload.model_dump(exclude_unset=True)

    _validate_choice("artist_type", data.get("artist_type"), constants.ARTIST_TYPES)
    _validate_choice("default_cost_currency", data.get("default_cost_currency"), constants.CURRENCIES)
    _validate_choice("default_sale_currency", data.get("default_sale_currency"), constants.CURRENCIES)
    _validate_partner(db=db, partner_id=data.get("manager_partner_id"))

    return artist_repository.update_artist(db=db, artist=artist, data=data)


def list_rider_items(db: Session, artist_id: int):
    get_artist_or_404(db=db, artist_id=artist_id)
    return artist_repository.list_rider_items(db=db, artist_id=artist_id)


def create_rider_item(db: Session, artist_id: int, payload: ArtistRiderTemplateItemCreate):
    get_artist_or_404(db=db, artist_id=artist_id)
    return artist_repository.create_rider_item(
        db=db,
        artist_id=artist_id,
        data=payload.model_dump(),
    )
