"""Şirket saatine (Europe/Istanbul = KKTC) göre tarih. Sunucu UTC'de çalışsa bile
"bugün" her zaman şirketin bugünüdür."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def now() -> datetime:
    return datetime.now(ZoneInfo(get_settings().timezone))


def today() -> date:
    return now().date()


def local_date(moment: datetime) -> date:
    """Veritabanından gelen (UTC) zaman damgasının şirket saatine göre günü."""
    return moment.astimezone(ZoneInfo(get_settings().timezone)).date()
