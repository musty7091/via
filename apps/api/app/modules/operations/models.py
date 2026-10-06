from datetime import date, datetime, time
from enum import StrEnum

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.modules.catalog.models import Artist, RiderCategory
from app.modules.users.models import User


class TaskCategory(StrEnum):
    SETUP = "setup"
    TECHNICAL = "technical"
    ARTIST = "artist"
    HOSPITALITY = "hospitality"
    TRANSPORT = "transport"
    TEARDOWN = "teardown"
    OTHER = "other"


class TaskStatus(StrEnum):
    TODO = "todo"
    DONE = "done"


class RiderStatus(StrEnum):
    PENDING = "pending"
    OK = "ok"
    PROBLEM = "problem"
    NOT_NEEDED = "not_needed"


class ReportStatus(StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"


class EventTask(TimestampMixin, Base):
    """Etkinlik operasyon görevi."""

    __tablename__ = "event_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[TaskCategory] = mapped_column(String(20))
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    assigned_to: Mapped[User | None] = relationship(foreign_keys=[assigned_to_id])
    due_date: Mapped[date | None] = mapped_column(Date)
    due_time: Mapped[time | None] = mapped_column(Time)
    is_required: Mapped[bool] = mapped_column(default=True)
    status: Mapped[TaskStatus] = mapped_column(String(10), default=TaskStatus.TODO, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    completed_by: Mapped[User | None] = relationship(foreign_keys=[completed_by_id])
    note: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(default=0)


class RiderCheck(TimestampMixin, Base):
    """Sanatçının rider/kulis şartının bu etkinlikteki kontrolü (katalogdaki şablondan kopya)."""

    __tablename__ = "rider_checks"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"))
    artist: Mapped[Artist | None] = relationship()
    rider_item_id: Mapped[int | None] = mapped_column(ForeignKey("artist_rider_items.id"))
    category: Mapped[RiderCategory] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    is_required: Mapped[bool] = mapped_column(default=True)
    status: Mapped[RiderStatus] = mapped_column(String(12), default=RiderStatus.PENDING, index=True)
    note: Mapped[str | None] = mapped_column(Text)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    checked_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    checked_by: Mapped[User | None] = relationship()
    sort_order: Mapped[int] = mapped_column(default=0)


class OperationReport(TimestampMixin, Base):
    """Etkinlik sonrası operasyon raporu."""

    __tablename__ = "operation_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), unique=True)
    status: Mapped[ReportStatus] = mapped_column(String(10), default=ReportStatus.DRAFT)
    actual_guest_count: Mapped[int | None]
    went_well: Mapped[str | None] = mapped_column(Text)
    issues: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    submitted_by: Mapped[User | None] = relationship()
