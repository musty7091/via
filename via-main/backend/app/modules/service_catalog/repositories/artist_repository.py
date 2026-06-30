from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.artist import Artist, ArtistRiderTemplateItem


def get_artist(db: Session, artist_id: int) -> Artist | None:
    return db.get(Artist, artist_id)


def list_artists(
    db: Session,
    search: str | None = None,
    artist_type: str | None = None,
    is_active: bool | None = True,
    skip: int = 0,
    limit: int = 100,
) -> list[Artist]:
    query = db.query(Artist)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Artist.name.ilike(term),
                Artist.notes.ilike(term),
            )
        )

    if artist_type:
        query = query.filter(Artist.artist_type == artist_type)

    if is_active is not None:
        query = query.filter(Artist.is_active == is_active)

    return query.order_by(Artist.name.asc()).offset(skip).limit(limit).all()


def create_artist(db: Session, data: dict) -> Artist:
    artist = Artist(**data)
    db.add(artist)
    db.commit()
    db.refresh(artist)
    return artist


def update_artist(db: Session, artist: Artist, data: dict) -> Artist:
    for key, value in data.items():
        setattr(artist, key, value)

    db.commit()
    db.refresh(artist)
    return artist


def list_rider_items(db: Session, artist_id: int) -> list[ArtistRiderTemplateItem]:
    return (
        db.query(ArtistRiderTemplateItem)
        .filter(ArtistRiderTemplateItem.artist_id == artist_id)
        .order_by(ArtistRiderTemplateItem.sort_order.asc(), ArtistRiderTemplateItem.id.asc())
        .all()
    )


def create_rider_item(db: Session, artist_id: int, data: dict) -> ArtistRiderTemplateItem:
    item = ArtistRiderTemplateItem(artist_id=artist_id, **data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
