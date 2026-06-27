from datetime import datetime

from pydantic import BaseModel, Field


# İzin verilen durumlar: bekliyor / tamam / sorunlu
RIDER_CHECK_STATUSES = ("pending", "done", "problem")


class RiderCheckRead(BaseModel):
    id: int
    event_id: int
    artist_id: int | None = None
    artist_name: str | None = None
    template_item_id: int | None = None
    checked_by_user_id: int | None = None
    checked_by_name: str | None = None
    title: str
    description: str | None = None
    category: str | None = None
    status: str
    checked_at: datetime | None = None
    problem_note: str | None = None
    sort_order: int
    is_required: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class RiderCheckCreate(BaseModel):
    """Listeye elle yeni bir kontrol maddesi eklemek için."""

    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: str | None = None
    artist_id: int | None = None
    is_required: bool = True


class RiderCheckUpdate(BaseModel):
    """Bir maddenin durumunu / notunu güncellemek için. Hepsi opsiyonel."""

    status: str | None = None
    problem_note: str | None = None
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    is_required: bool | None = None


class RiderCheckSummary(BaseModel):
    total: int
    done: int
    problem: int
    pending: int
    required_total: int
    required_done: int
    all_required_done: bool


class EventRiderArtist(BaseModel):
    """Etkinlikteki sanatçı + bu sanatçıdan kaç madde üretilebilir bilgisi."""

    artist_id: int
    artist_name: str
    template_item_count: int


class RiderCheckBoard(BaseModel):
    event_id: int
    event_title: str
    event_date: str | None = None
    summary: RiderCheckSummary
    artists: list[EventRiderArtist]
    items: list[RiderCheckRead]


class GenerateResult(BaseModel):
    created_count: int
    skipped_count: int
    board: RiderCheckBoard
