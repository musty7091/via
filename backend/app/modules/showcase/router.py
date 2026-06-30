"""
VİTRİN (showcase) router'ları.

İki ayrı router:
  - public_router: HALKA AÇIK (giriş gerektirmez). Yalnızca aktif kayıtları döner.
  - admin_router : Yalnızca super_admin. Sanatçı ekleme/düzenleme/silme.

Operasyon/finans alanlarından tamamen bağımsızdır.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_super_admin
from app.db.database import get_db
from app.models.showcase import ShowcaseArtist
from app.models.user import User
from app.modules.showcase import (
    ShowcaseArtistAdmin,
    ShowcaseArtistCreate,
    ShowcaseArtistPublic,
    ShowcaseArtistUpdate,
    ShowcaseCategory,
)

# Kanonik kategori sırası ve etiketleri (sekmeler bu sıraya göre dizilir)
CATEGORY_LABELS: dict[str, str] = {
    "gruplar": "Gruplar",
    "solo": "Solo Sanatçı",
    "dj": "DJ",
    "dansci": "Dansçı",
    "muzik": "Müzik / Orkestra",
    "gosteri": "Gösteri / Performans",
    "diger": "Diğer",
}
CATEGORY_ORDER = list(CATEGORY_LABELS.keys())


def _label_for(key: str) -> str:
    return CATEGORY_LABELS.get(key, key.replace("_", " ").title())


def _order_index(key: str) -> int:
    return CATEGORY_ORDER.index(key) if key in CATEGORY_ORDER else len(CATEGORY_ORDER)


# ============================ HALKA AÇIK ===================================
public_router = APIRouter(prefix="/public/showcase", tags=["Vitrin (Halka Açık)"])


@public_router.get("/categories", response_model=list[ShowcaseCategory])
def public_categories(db: Session = Depends(get_db)):
    """Aktif sanatçısı olan kategoriler (sekmeler için), adetleriyle birlikte."""
    rows = (
        db.query(ShowcaseArtist.category, func.count(ShowcaseArtist.id))
        .filter(ShowcaseArtist.is_active.is_(True))
        .group_by(ShowcaseArtist.category)
        .all()
    )
    cats = [
        ShowcaseCategory(key=key, label=_label_for(key), count=count)
        for key, count in rows
    ]
    cats.sort(key=lambda c: _order_index(c.key))
    return cats


@public_router.get("/artists", response_model=list[ShowcaseArtistPublic])
def public_artists(
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Aktif sanatçılar; kategori verilirse o kategoriye süzülür."""
    q = db.query(ShowcaseArtist).filter(ShowcaseArtist.is_active.is_(True))
    if category:
        q = q.filter(ShowcaseArtist.category == category)
    q = q.order_by(ShowcaseArtist.sort_order.asc(), ShowcaseArtist.id.desc())
    return q.all()


@public_router.get("/artists/{artist_id}", response_model=ShowcaseArtistPublic)
def public_artist_detail(artist_id: int, db: Session = Depends(get_db)):
    artist = (
        db.query(ShowcaseArtist)
        .filter(ShowcaseArtist.id == artist_id, ShowcaseArtist.is_active.is_(True))
        .first()
    )
    if not artist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sanatçı bulunamadı")
    return artist


# ============================ YÖNETİM (ADMIN) ==============================
admin_router = APIRouter(
    prefix="/showcase",
    tags=["Vitrin (Yönetim)"],
    dependencies=[Depends(get_current_super_admin)],
)


@admin_router.get("/categories", response_model=list[ShowcaseCategory])
def admin_categories():
    """Yönetim formundaki kategori seçenekleri (tüm kanonik liste)."""
    return [
        ShowcaseCategory(key=key, label=label, count=0)
        for key, label in CATEGORY_LABELS.items()
    ]


@admin_router.get("/artists", response_model=list[ShowcaseArtistAdmin])
def admin_list_artists(db: Session = Depends(get_db)):
    """Tüm sanatçılar (pasifler dahil)."""
    return (
        db.query(ShowcaseArtist)
        .order_by(ShowcaseArtist.sort_order.asc(), ShowcaseArtist.id.desc())
        .all()
    )


@admin_router.post("/artists", response_model=ShowcaseArtistAdmin, status_code=status.HTTP_201_CREATED)
def admin_create_artist(
    payload: ShowcaseArtistCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_super_admin),
):
    artist = ShowcaseArtist(**payload.model_dump())
    db.add(artist)
    db.commit()
    db.refresh(artist)
    return artist


@admin_router.put("/artists/{artist_id}", response_model=ShowcaseArtistAdmin)
def admin_update_artist(
    artist_id: int,
    payload: ShowcaseArtistUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_super_admin),
):
    artist = db.query(ShowcaseArtist).filter(ShowcaseArtist.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sanatçı bulunamadı")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(artist, field, value)
    db.commit()
    db.refresh(artist)
    return artist


@admin_router.delete("/artists/{artist_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_artist(
    artist_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_super_admin),
):
    artist = db.query(ShowcaseArtist).filter(ShowcaseArtist.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sanatçı bulunamadı")
    db.delete(artist)
    db.commit()
    return None
