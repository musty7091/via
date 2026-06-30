"""
Halka açık VİTRİN (showcase) sanatçı modeli.

ÖNEMLİ: Bu yapı operasyon/finans tarafındaki `artists` tablosundan TAMAMEN
BAĞIMSIZDIR. Burası yalnızca halka açık vitrinde gösterilen tanıtım kayıtlarıdır;
teklif/anlaşma/etkinlik akışıyla ilişkisi yoktur.
"""

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import TimestampMixin


class ShowcaseArtist(TimestampMixin, Base):
    __tablename__ = "showcase_artists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Kategori: gruplar / solo / dj / dansci / ... (sekme bu alana göre oluşur)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    tagline: Mapped[str | None] = mapped_column(String(300), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Kart görseli (sabit) ve hover'da oynayan flu video (opsiyonel)
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Detay sayfası için opsiyonel sosyal bağlantılar
    instagram_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    youtube_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    spotify_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
