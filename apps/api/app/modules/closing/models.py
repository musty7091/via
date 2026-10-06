from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.modules.events.models import Event


class PeriodStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class AccountingPeriod(TimestampMixin, Base):
    """Aylık muhasebe dönemi (YYYY-MM). Kapanan döneme kayıt yapılamaz."""

    __tablename__ = "accounting_periods"

    id: Mapped[int] = mapped_column(primary_key=True)
    month: Mapped[str] = mapped_column(String(7), unique=True)  # "2026-10"
    status: Mapped[PeriodStatus] = mapped_column(String(10), default=PeriodStatus.OPEN)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    # Genel giderlerin ortaklara yansıtıldığı fiş
    entry_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    # Kapanış anındaki dondurulmuş rapor
    snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    reopened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reopen_reason: Mapped[str | None] = mapped_column(Text)


class ClosureStatus(StrEnum):
    CLOSED = "closed"
    REOPENED = "reopened"


class EventClosure(TimestampMixin, Base):
    """Etkinlik finans kapanışı: gerçekleşen kâr/zarar ortaklara eşit dağıtılır."""

    __tablename__ = "event_closures"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    event: Mapped[Event] = relationship()
    status: Mapped[ClosureStatus] = mapped_column(
        String(10), default=ClosureStatus.CLOSED, index=True
    )
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    revenue: Mapped[Decimal]
    cost: Mapped[Decimal]
    expense: Mapped[Decimal]
    fx: Mapped[Decimal]
    profit: Mapped[Decimal]
    # [{"partner_id": 1, "name": "Alper", "share": "10000.00"}, ...]
    shares: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    entry_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    note: Mapped[str | None] = mapped_column(Text)
    reopened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reopen_reason: Mapped[str | None] = mapped_column(Text)
