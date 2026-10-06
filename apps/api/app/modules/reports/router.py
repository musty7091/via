from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession, require
from app.core.errors import DomainError
from app.core.permissions import Permission
from app.modules.reports import period_summary, service
from app.modules.reports.service import ArtistRow, CustomerRow, EventReport, MonthlyReport
from app.modules.users.models import User

router = APIRouter(prefix="/reports", tags=["reports"])

Viewer = Annotated[User, Depends(require(Permission.REPORTS_VIEW))]
Month = Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")]


def _range(date_from: date, date_to: date) -> None:
    if date_from > date_to:
        raise DomainError("Başlangıç tarihi bitişten sonra olamaz.")
    if (date_to - date_from).days > 3 * 366:
        raise DomainError("En fazla 3 yıllık aralık seçilebilir.")


@router.get("/events", response_model=EventReport)
def event_report(
    db: DbSession,
    _: Viewer,
    date_from: date,
    date_to: date,
    partner_id: int | None = None,
) -> EventReport:
    _range(date_from, date_to)
    return service.event_report(db, date_from=date_from, date_to=date_to, partner_id=partner_id)


@router.get("/monthly", response_model=MonthlyReport)
def monthly_report(
    db: DbSession, _: Viewer, first: Month = None, last: Month = None
) -> MonthlyReport:
    default_first, default_last = service.default_months()
    first, last = first or default_first, last or default_last
    if first > last:
        raise DomainError("Başlangıç ayı bitiş ayından sonra olamaz.")
    if int(last[:4]) * 12 + int(last[5:]) - int(first[:4]) * 12 - int(first[5:]) >= 36:
        raise DomainError("En fazla 36 ay seçilebilir.")
    return service.monthly_report(db, first=first, last=last)


@router.get("/artists", response_model=list[ArtistRow])
def artist_report(db: DbSession, _: Viewer, date_from: date, date_to: date) -> list[ArtistRow]:
    _range(date_from, date_to)
    return service.artist_report(db, date_from=date_from, date_to=date_to)


@router.get("/customers", response_model=list[CustomerRow])
def customer_report(db: DbSession, _: Viewer, date_from: date, date_to: date) -> list[CustomerRow]:
    _range(date_from, date_to)
    return service.customer_report(db, date_from=date_from, date_to=date_to)


@router.get("/period-summary", response_model=period_summary.PeriodSummary)
def get_period_summary(
    db: DbSession, _: Viewer, month: Month = None
) -> period_summary.PeriodSummary:
    return period_summary.period_summary(db, month or service.default_months(1)[1])
