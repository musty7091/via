from pydantic import BaseModel, ConfigDict


# Halka açık vitrin için sanatçı çıktısı
class ShowcaseArtistPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    name: str
    tagline: str | None = None
    description: str | None = None
    image_url: str | None = None
    video_url: str | None = None
    instagram_url: str | None = None
    youtube_url: str | None = None
    spotify_url: str | None = None


# Yönetim (admin) çıktısı — aktiflik ve sıralama dahil
class ShowcaseArtistAdmin(ShowcaseArtistPublic):
    is_active: bool
    sort_order: int


class ShowcaseArtistCreate(BaseModel):
    category: str
    name: str
    tagline: str | None = None
    description: str | None = None
    image_url: str | None = None
    video_url: str | None = None
    instagram_url: str | None = None
    youtube_url: str | None = None
    spotify_url: str | None = None
    is_active: bool = True
    sort_order: int = 0


class ShowcaseArtistUpdate(BaseModel):
    category: str | None = None
    name: str | None = None
    tagline: str | None = None
    description: str | None = None
    image_url: str | None = None
    video_url: str | None = None
    instagram_url: str | None = None
    youtube_url: str | None = None
    spotify_url: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class ShowcaseCategory(BaseModel):
    key: str
    label: str
    count: int
