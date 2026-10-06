from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import DomainError
from app.modules.closing.models import AccountingPeriod, PeriodStatus

MONTHS_TR = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
]


def month_key(day: date) -> str:
    return f"{day.year:04d}-{day.month:02d}"


def month_label(day: date) -> str:
    return f"{MONTHS_TR[day.month - 1]} {day.year}"


def assert_period_open(db: Session, entry_date: date) -> None:
    """Kapanmış aya hiçbir finans kaydı yapılamaz (iptal ters kaydı dahil)."""
    status = db.scalar(
        select(AccountingPeriod.status).where(AccountingPeriod.month == month_key(entry_date))
    )
    if status == PeriodStatus.CLOSED:
        raise DomainError(
            f"{month_label(entry_date)} dönemi kapalı; bu tarihe kayıt yapılamaz. "
            "İşlemi açık bir döneme tarihleyin."
        )


def event_closed(db: Session, event_id: int | None) -> bool:
    from app.modules.closing.models import ClosureStatus, EventClosure  # noqa: PLC0415

    if event_id is None:
        return False
    return (
        db.scalar(
            select(EventClosure.id).where(
                EventClosure.event_id == event_id, EventClosure.status == ClosureStatus.CLOSED
            )
        )
        is not None
    )


def ensure_event_open(db: Session, event_id: int | None) -> None:
    """Finans kapanışı yapılmış etkinliğin kârını değiştiren kayıtları engeller."""
    if event_closed(db, event_id):
        raise DomainError(
            "Bu etkinliğin finans kapanışı yapıldı; kârı değiştirecek kayıt girilemez. "
            "Gerekirse önce kapanışı geri alın."
        )
