from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.artist import Artist, ArtistRiderTemplateItem
from app.models.event import Event, EventItem
from app.models.operation import EventRiderCheck
from app.models.user import User
from app.modules.operations.schemas import (
    RIDER_CHECK_STATUSES,
    EventRiderArtist,
    RiderCheckBoard,
    RiderCheckCreate,
    RiderCheckRead,
    RiderCheckSummary,
    RiderCheckUpdate,
)


def _get_event_or_404(db: Session, event_id: int) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etkinlik bulunamadı.",
        )
    return event


def _get_check_or_404(db: Session, check_id: int) -> EventRiderCheck:
    check = db.get(EventRiderCheck, check_id)
    if check is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kontrol maddesi bulunamadı.",
        )
    return check


def _artist_name_map(db: Session, artist_ids: set[int]) -> dict[int, str]:
    if not artist_ids:
        return {}
    rows = db.query(Artist.id, Artist.name).filter(Artist.id.in_(artist_ids)).all()
    return {row[0]: row[1] for row in rows}


def _user_name_map(db: Session, user_ids: set[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    rows = db.query(User.id, User.full_name).filter(User.id.in_(user_ids)).all()
    return {row[0]: row[1] for row in rows}


def _to_read(
    check: EventRiderCheck,
    artist_names: dict[int, str],
    user_names: dict[int, str],
) -> RiderCheckRead:
    data = RiderCheckRead.model_validate(check)
    if check.artist_id is not None:
        data.artist_name = artist_names.get(check.artist_id)
    if check.checked_by_user_id is not None:
        data.checked_by_name = user_names.get(check.checked_by_user_id)
    return data


def _event_artist_ids(db: Session, event_id: int) -> list[int]:
    """Etkinlik kalemlerindeki (event_items) benzersiz sanatçı id'leri."""
    rows = (
        db.query(EventItem.artist_id)
        .filter(EventItem.event_id == event_id, EventItem.artist_id.isnot(None))
        .distinct()
        .all()
    )
    return [row[0] for row in rows]


def build_board(db: Session, event_id: int) -> RiderCheckBoard:
    event = _get_event_or_404(db, event_id)

    checks = (
        db.query(EventRiderCheck)
        .filter(EventRiderCheck.event_id == event_id)
        .order_by(EventRiderCheck.sort_order, EventRiderCheck.id)
        .all()
    )

    # Etkinlikteki sanatçılar + her birinin şablon madde sayısı
    artist_ids = _event_artist_ids(db, event_id)
    name_map = _artist_name_map(db, set(artist_ids))

    artists: list[EventRiderArtist] = []
    for artist_id in artist_ids:
        template_count = (
            db.query(func.count(ArtistRiderTemplateItem.id))
            .filter(
                ArtistRiderTemplateItem.artist_id == artist_id,
                ArtistRiderTemplateItem.is_active.is_(True),
            )
            .scalar()
            or 0
        )
        artists.append(
            EventRiderArtist(
                artist_id=artist_id,
                artist_name=name_map.get(artist_id, f"Sanatçı #{artist_id}"),
                template_item_count=int(template_count),
            )
        )

    # İsim haritaları (kontrol maddelerindeki sanatçı + kontrol eden kullanıcı)
    check_artist_ids = {c.artist_id for c in checks if c.artist_id is not None}
    user_ids = {c.checked_by_user_id for c in checks if c.checked_by_user_id is not None}
    all_artist_names = _artist_name_map(db, check_artist_ids | set(artist_ids))
    user_names = _user_name_map(db, user_ids)

    items = [_to_read(c, all_artist_names, user_names) for c in checks]

    done = sum(1 for c in checks if c.status == "done")
    problem = sum(1 for c in checks if c.status == "problem")
    pending = sum(1 for c in checks if c.status == "pending")
    required_total = sum(1 for c in checks if c.is_required)
    required_done = sum(1 for c in checks if c.is_required and c.status == "done")

    summary = RiderCheckSummary(
        total=len(checks),
        done=done,
        problem=problem,
        pending=pending,
        required_total=required_total,
        required_done=required_done,
        all_required_done=required_total > 0 and required_done == required_total,
    )

    return RiderCheckBoard(
        event_id=event.id,
        event_title=event.title,
        event_date=event.event_date.isoformat() if event.event_date else None,
        summary=summary,
        artists=artists,
        items=items,
    )


def generate_from_artists(db: Session, event_id: int) -> tuple[int, int]:
    """
    Etkinlikteki her sanatçının aktif rider şablon maddelerinden, bu etkinliğe
    özel kontrol maddeleri üretir. Daha önce üretilmiş (aynı sanatçı + aynı
    şablon maddesi) kayıtlar tekrar oluşturulmaz.

    Döner: (oluşturulan, atlanan)
    """
    _get_event_or_404(db, event_id)

    artist_ids = _event_artist_ids(db, event_id)
    if not artist_ids:
        return (0, 0)

    # Bu etkinlik için zaten var olan (artist_id, template_item_id) çiftleri
    existing_pairs = {
        (c.artist_id, c.template_item_id)
        for c in db.query(EventRiderCheck)
        .filter(
            EventRiderCheck.event_id == event_id,
            EventRiderCheck.template_item_id.isnot(None),
        )
        .all()
    }

    max_sort = (
        db.query(func.max(EventRiderCheck.sort_order))
        .filter(EventRiderCheck.event_id == event_id)
        .scalar()
        or 0
    )

    created = 0
    skipped = 0
    next_sort = int(max_sort)

    template_items = (
        db.query(ArtistRiderTemplateItem)
        .filter(
            ArtistRiderTemplateItem.artist_id.in_(artist_ids),
            ArtistRiderTemplateItem.is_active.is_(True),
        )
        .order_by(ArtistRiderTemplateItem.artist_id, ArtistRiderTemplateItem.sort_order)
        .all()
    )

    for tpl in template_items:
        if (tpl.artist_id, tpl.id) in existing_pairs:
            skipped += 1
            continue

        next_sort += 1
        db.add(
            EventRiderCheck(
                event_id=event_id,
                artist_id=tpl.artist_id,
                template_item_id=tpl.id,
                title=tpl.title,
                description=tpl.description,
                status="pending",
                sort_order=next_sort,
                is_required=tpl.is_required,
            )
        )
        created += 1

    if created:
        db.commit()

    return (created, skipped)


def add_manual_check(
    db: Session, event_id: int, payload: RiderCheckCreate
) -> RiderCheckRead:
    _get_event_or_404(db, event_id)

    if payload.artist_id is not None and db.get(Artist, payload.artist_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Belirtilen sanatçı bulunamadı.",
        )

    max_sort = (
        db.query(func.max(EventRiderCheck.sort_order))
        .filter(EventRiderCheck.event_id == event_id)
        .scalar()
        or 0
    )

    check = EventRiderCheck(
        event_id=event_id,
        artist_id=payload.artist_id,
        template_item_id=None,
        title=payload.title.strip(),
        description=payload.description,
        status="pending",
        sort_order=int(max_sort) + 1,
        is_required=payload.is_required,
    )
    db.add(check)
    db.commit()
    db.refresh(check)

    artist_names = _artist_name_map(
        db, {check.artist_id} if check.artist_id else set()
    )
    return _to_read(check, artist_names, {})


def update_check(
    db: Session,
    check_id: int,
    payload: RiderCheckUpdate,
    current_user: User,
) -> RiderCheckRead:
    check = _get_check_or_404(db, check_id)

    if payload.status is not None:
        if payload.status not in RIDER_CHECK_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geçersiz durum. Kullanılabilir: pending, done, problem.",
            )
        check.status = payload.status

        if payload.status == "done":
            check.checked_at = datetime.now(UTC)
            check.checked_by_user_id = current_user.id
        elif payload.status == "pending":
            # Geri alındıysa kontrol izlerini temizle
            check.checked_at = None
            check.checked_by_user_id = None
            check.problem_note = None

    if payload.problem_note is not None:
        check.problem_note = payload.problem_note or None

    if payload.title is not None and payload.title.strip():
        check.title = payload.title.strip()

    if payload.description is not None:
        check.description = payload.description or None

    if payload.is_required is not None:
        check.is_required = payload.is_required

    db.commit()
    db.refresh(check)

    artist_names = _artist_name_map(
        db, {check.artist_id} if check.artist_id else set()
    )
    user_names = _user_name_map(
        db, {check.checked_by_user_id} if check.checked_by_user_id else set()
    )
    return _to_read(check, artist_names, user_names)


def delete_check(db: Session, check_id: int) -> None:
    check = _get_check_or_404(db, check_id)
    db.delete(check)
    db.commit()
