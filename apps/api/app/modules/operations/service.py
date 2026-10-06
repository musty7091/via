"""Etkinlik operasyonu: görevler, rider/kulis kontrolü ve operasyon raporu."""

from datetime import date, datetime, time, timedelta
from typing import Annotated, Literal

from pydantic import Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.deps import RequestContext
from app.core.errors import DomainError, NotFoundError
from app.core.permissions import Permission, Role, permissions_for
from app.core.schemas import ApiModel, LongText, blank_to_none
from app.modules.audit import service as audit
from app.modules.catalog.models import ArtistRiderItem, RiderCategory
from app.modules.events.models import Event, EventStatus
from app.modules.offers.models import LineType
from app.modules.offers.schemas import Ref
from app.modules.operations.models import (
    EventTask,
    OperationReport,
    ReportStatus,
    RiderCheck,
    RiderStatus,
    TaskCategory,
    TaskStatus,
)
from app.modules.users.models import User

# Her anlaşmada açılan standart görevler: (başlık, kategori, etkinlikten kaç gün önce)
DEFAULT_TASKS: list[tuple[str, TaskCategory, int]] = [
    ("Mekân ile teknik keşif ve teyit", TaskCategory.SETUP, 7),
    ("Sanatçı ulaşım ve konaklama teyidi", TaskCategory.TRANSPORT, 3),
    ("Kulis hazırlığı (rider şartları)", TaskCategory.HOSPITALITY, 0),
    ("Sahne ve ses kurulumu", TaskCategory.TECHNICAL, 0),
    ("Ses / ışık kontrolü (soundcheck)", TaskCategory.TECHNICAL, 0),
    ("Sanatçı karşılama", TaskCategory.ARTIST, 0),
    ("Söküm ve mekân teslimi", TaskCategory.TEARDOWN, 0),
]

TASK_LABELS = {
    TaskCategory.SETUP: "Hazırlık",
    TaskCategory.TECHNICAL: "Teknik",
    TaskCategory.ARTIST: "Sanatçı",
    TaskCategory.HOSPITALITY: "Kulis / ikram",
    TaskCategory.TRANSPORT: "Ulaşım",
    TaskCategory.TEARDOWN: "Söküm",
    TaskCategory.OTHER: "Diğer",
}


# --- Şemalar ---


class _Blankable(ApiModel):
    @field_validator(
        "description", "note", "went_well", "issues", "notes", mode="before", check_fields=False
    )
    @classmethod
    def _blank(cls, value: object) -> object:
        return blank_to_none(value)


class TaskRead(ApiModel):
    id: int
    title: str
    description: str | None
    category: TaskCategory
    assigned_to: Ref | None
    due_date: date | None
    due_time: time | None
    is_required: bool
    status: TaskStatus
    is_overdue: bool
    completed_at: datetime | None
    completed_by: str | None
    note: str | None
    sort_order: int


class TaskCreate(_Blankable):
    title: Annotated[str, Field(min_length=2, max_length=200)]
    description: LongText | None = None
    category: TaskCategory = TaskCategory.OTHER
    assigned_to_id: int | None = None
    due_date: date | None = None
    due_time: time | None = None
    is_required: bool = True


class TaskUpdate(_Blankable):
    title: Annotated[str, Field(min_length=2, max_length=200)] | None = None
    description: LongText | None = None
    category: TaskCategory | None = None
    assigned_to_id: int | None = None
    due_date: date | None = None
    due_time: time | None = None
    is_required: bool | None = None
    status: TaskStatus | None = None
    note: LongText | None = None


class RiderCheckRead(ApiModel):
    id: int
    artist: Ref | None
    category: RiderCategory
    title: str
    description: str | None
    is_required: bool
    status: RiderStatus
    note: str | None
    checked_at: datetime | None
    checked_by: str | None


class RiderCheckUpdate(_Blankable):
    status: RiderStatus
    note: LongText | None = None


class RiderCheckCreate(_Blankable):
    title: Annotated[str, Field(min_length=2, max_length=200)]
    category: RiderCategory = RiderCategory.OTHER
    description: LongText | None = None
    is_required: bool = True


class ReportRead(ApiModel):
    status: ReportStatus
    actual_guest_count: int | None
    went_well: str | None
    issues: str | None
    notes: str | None
    submitted_at: datetime | None
    submitted_by: str | None


class ReportSave(_Blankable):
    actual_guest_count: Annotated[int, Field(ge=0, le=100_000)] | None = None
    went_well: LongText | None = None
    issues: LongText | None = None
    notes: LongText | None = None
    submit: bool = False


class Progress(ApiModel):
    tasks_total: int
    tasks_done: int
    riders_total: int
    riders_ok: int
    rider_problems: int
    report: Literal["none", "draft", "submitted"]


class EventOperations(ApiModel):
    event_id: int
    can_manage: bool
    progress: Progress
    tasks: list[TaskRead]
    rider_checks: list[RiderCheckRead]
    report: ReportRead | None
    assignees: list[Ref]


class BoardItem(ApiModel):
    event_id: int
    event_no: str
    title: str
    customer: str
    venue: str | None
    event_date: date
    start_time: time | None
    status: EventStatus
    progress: Progress


class MyTask(ApiModel):
    task: TaskRead
    event_id: int
    event_title: str
    event_date: date


# --- Okuma ---


def task_read(task: EventTask, today: date) -> TaskRead:
    return TaskRead(
        id=task.id,
        title=task.title,
        description=task.description,
        category=task.category,
        assigned_to=Ref(id=task.assigned_to.id, name=task.assigned_to.full_name)
        if task.assigned_to
        else None,
        due_date=task.due_date,
        due_time=task.due_time,
        is_required=task.is_required,
        status=task.status,
        is_overdue=task.status == TaskStatus.TODO
        and task.due_date is not None
        and task.due_date < today,
        completed_at=task.completed_at,
        completed_by=task.completed_by.full_name if task.completed_by else None,
        note=task.note,
        sort_order=task.sort_order,
    )


def rider_read(check: RiderCheck) -> RiderCheckRead:
    return RiderCheckRead(
        id=check.id,
        artist=Ref(id=check.artist.id, name=check.artist.name) if check.artist else None,
        category=check.category,
        title=check.title,
        description=check.description,
        is_required=check.is_required,
        status=check.status,
        note=check.note,
        checked_at=check.checked_at,
        checked_by=check.checked_by.full_name if check.checked_by else None,
    )


def progress(db: Session, event_id: int) -> Progress:
    task_counts = dict(
        db.execute(
            select(EventTask.status, func.count())
            .where(EventTask.event_id == event_id)
            .group_by(EventTask.status)
        ).all()
    )
    rider_counts = dict(
        db.execute(
            select(RiderCheck.status, func.count())
            .where(RiderCheck.event_id == event_id)
            .group_by(RiderCheck.status)
        ).all()
    )
    report_status = db.scalar(
        select(OperationReport.status).where(OperationReport.event_id == event_id)
    )
    return Progress(
        tasks_total=sum(task_counts.values()),
        tasks_done=task_counts.get(TaskStatus.DONE, 0),
        riders_total=sum(rider_counts.values()),
        riders_ok=rider_counts.get(RiderStatus.OK, 0) + rider_counts.get(RiderStatus.NOT_NEEDED, 0),
        rider_problems=rider_counts.get(RiderStatus.PROBLEM, 0),
        report=report_status or "none",
    )


def _assignees(db: Session) -> list[Ref]:
    roles = [r for r in Role if Permission.OPERATIONS_MANAGE in permissions_for(r)]
    users = db.scalars(
        select(User).where(User.is_active.is_(True), User.role.in_(roles)).order_by(User.full_name)
    )
    return [Ref(id=u.id, name=u.full_name) for u in users]


def event_operations(db: Session, event: Event, user: User) -> EventOperations:
    today = clock.today()
    tasks = db.scalars(
        select(EventTask)
        .where(EventTask.event_id == event.id)
        .order_by(EventTask.sort_order, EventTask.id)
    ).all()
    checks = db.scalars(
        select(RiderCheck)
        .where(RiderCheck.event_id == event.id)
        .order_by(RiderCheck.artist_id.nulls_last(), RiderCheck.sort_order, RiderCheck.id)
    ).all()
    report = db.scalar(select(OperationReport).where(OperationReport.event_id == event.id))
    return EventOperations(
        event_id=event.id,
        can_manage=Permission.OPERATIONS_MANAGE in permissions_for(user.role)
        and event.status != EventStatus.CANCELLED,
        progress=progress(db, event.id),
        tasks=[task_read(t, today) for t in tasks],
        rider_checks=[rider_read(c) for c in checks],
        report=ReportRead(
            status=report.status,
            actual_guest_count=report.actual_guest_count,
            went_well=report.went_well,
            issues=report.issues,
            notes=report.notes,
            submitted_at=report.submitted_at,
            submitted_by=report.submitted_by.full_name if report.submitted_by else None,
        )
        if report
        else None,
        assignees=_assignees(db),
    )


def board(db: Session, *, days: int) -> list[BoardItem]:
    today = clock.today()
    events = db.scalars(
        select(Event)
        .where(
            Event.status != EventStatus.CANCELLED,
            Event.event_date >= today - timedelta(days=7),
            Event.event_date <= today + timedelta(days=days),
        )
        .order_by(Event.event_date, Event.start_time.nulls_last())
    ).all()
    return [
        BoardItem(
            event_id=e.id,
            event_no=e.event_no,
            title=e.title,
            customer=e.customer.name,
            venue=e.venue.name if e.venue else None,
            event_date=e.event_date,
            start_time=e.start_time,
            status=e.status,
            progress=progress(db, e.id),
        )
        for e in events
    ]


def my_tasks(db: Session, user: User) -> list[MyTask]:
    today = clock.today()
    rows = db.execute(
        select(EventTask, Event)
        .join(Event, Event.id == EventTask.event_id)
        .where(
            EventTask.assigned_to_id == user.id,
            EventTask.status == TaskStatus.TODO,
            Event.status != EventStatus.CANCELLED,
        )
        .order_by(EventTask.due_date.nulls_last(), Event.event_date)
    ).all()
    return [
        MyTask(
            task=task_read(t, today), event_id=e.id, event_title=e.title, event_date=e.event_date
        )
        for t, e in rows
    ]


# --- Yazma ---


def _ensure_active(event: Event) -> None:
    if event.status == EventStatus.CANCELLED:
        raise DomainError("İptal edilmiş etkinliğin operasyonu değiştirilemez.")


def _check_assignee(db: Session, user_id: int | None) -> None:
    if user_id is None:
        return
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise DomainError("Atanacak kullanıcı bulunamadı veya pasif.")


def create_default_tasks(db: Session, event: Event) -> None:
    """Anlaşmada standart görev listesi açılır (etkinlik tarihine göre saatlenir)."""
    for order, (title, category, days_before) in enumerate(DEFAULT_TASKS, start=1):
        db.add(
            EventTask(
                event_id=event.id,
                title=title,
                category=category,
                due_date=event.event_date - timedelta(days=days_before),
                sort_order=order * 10,
            )
        )


def sync_rider_checks(db: Session, event: Event) -> int:
    """Etkinlikteki sanatçıların aktif rider şartlarını kontrol listesine ekler.
    Daha önce eklenmiş şartlar tekrar eklenmez. Eklenen şart sayısını döner."""
    artist_ids = {
        item.artist_id
        for item in event.items
        if item.artist_id and item.line_type != LineType.PACKAGE
    }
    existing = set(
        db.scalars(
            select(RiderCheck.rider_item_id).where(
                RiderCheck.event_id == event.id, RiderCheck.rider_item_id.is_not(None)
            )
        )
    )
    added = 0
    items = db.scalars(
        select(ArtistRiderItem)
        .where(ArtistRiderItem.artist_id.in_(artist_ids), ArtistRiderItem.is_active.is_(True))
        .order_by(ArtistRiderItem.artist_id, ArtistRiderItem.sort_order, ArtistRiderItem.id)
    )
    for item in items:
        if item.id in existing:
            continue
        db.add(
            RiderCheck(
                event_id=event.id,
                artist_id=item.artist_id,
                rider_item_id=item.id,
                category=item.category,
                title=item.title,
                description=item.description,
                is_required=item.is_required,
                sort_order=item.sort_order,
            )
        )
        added += 1
    return added


def sync_from_catalog(db: Session, event: Event) -> int:
    _ensure_active(event)
    added = sync_rider_checks(db, event)
    db.commit()
    return added


def on_agreement(db: Session, event: Event) -> None:
    create_default_tasks(db, event)
    sync_rider_checks(db, event)


def get_task(db: Session, task_id: int) -> EventTask:
    task = db.get(EventTask, task_id)
    if task is None:
        raise NotFoundError("Görev bulunamadı.")
    return task


def get_rider_check(db: Session, check_id: int) -> RiderCheck:
    check = db.get(RiderCheck, check_id)
    if check is None:
        raise NotFoundError("Rider kontrolü bulunamadı.")
    return check


def create_task(db: Session, event: Event, data: TaskCreate) -> EventTask:
    _ensure_active(event)
    _check_assignee(db, data.assigned_to_id)
    last = db.scalar(
        select(func.coalesce(func.max(EventTask.sort_order), 0)).where(
            EventTask.event_id == event.id
        )
    )
    task = EventTask(event_id=event.id, **data.model_dump(), sort_order=last + 10)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, task: EventTask, data: TaskUpdate, *, actor: User) -> EventTask:
    event = db.get(Event, task.event_id)
    _ensure_active(event)  # type: ignore[arg-type]
    changes = data.model_dump(exclude_unset=True)
    for key in ("title", "category", "is_required", "status"):
        if changes.get(key, "") is None:
            changes.pop(key)
    if "assigned_to_id" in changes:
        _check_assignee(db, changes["assigned_to_id"])
    if "status" in changes and changes["status"] != task.status:
        done = changes["status"] == TaskStatus.DONE
        task.completed_at = clock.now() if done else None
        task.completed_by_id = actor.id if done else None
    for key, value in changes.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task: EventTask) -> None:
    event = db.get(Event, task.event_id)
    _ensure_active(event)  # type: ignore[arg-type]
    db.delete(task)
    db.commit()


def update_rider_check(
    db: Session, check: RiderCheck, data: RiderCheckUpdate, *, actor: User, context: RequestContext
) -> RiderCheck:
    event = db.get(Event, check.event_id)
    _ensure_active(event)  # type: ignore[arg-type]
    if data.status == RiderStatus.PROBLEM and not data.note:
        raise DomainError("Sorunu kısaca açıklayın.")
    check.status = data.status
    check.note = data.note
    check.checked_at = None if data.status == RiderStatus.PENDING else clock.now()
    check.checked_by_id = None if data.status == RiderStatus.PENDING else actor.id
    if data.status == RiderStatus.PROBLEM:
        audit.record(
            db,
            actor=actor,
            action="operation.rider_problem",
            entity_type="event",
            entity_id=check.event_id,
            summary=f"Rider sorunu: {check.title}. {data.note}",
            context=context,
        )
    db.commit()
    db.refresh(check)
    return check


def create_rider_check(db: Session, event: Event, data: RiderCheckCreate) -> RiderCheck:
    _ensure_active(event)
    check = RiderCheck(event_id=event.id, **data.model_dump(), sort_order=999)
    db.add(check)
    db.commit()
    db.refresh(check)
    return check


def save_report(
    db: Session, event: Event, data: ReportSave, *, actor: User, context: RequestContext
) -> OperationReport:
    _ensure_active(event)
    if data.submit and event.event_date > clock.today():
        raise DomainError("Operasyon raporu etkinlik günü veya sonrasında teslim edilebilir.")
    report = db.scalar(select(OperationReport).where(OperationReport.event_id == event.id))
    if report is None:
        report = OperationReport(event_id=event.id)
        db.add(report)
    values = data.model_dump(exclude={"submit"})
    for key, value in values.items():
        setattr(report, key, value)
    if data.submit:
        report.status = ReportStatus.SUBMITTED
        report.submitted_at = clock.now()
        report.submitted_by_id = actor.id
        audit.record(
            db,
            actor=actor,
            action="operation.report_submit",
            entity_type="event",
            entity_id=event.id,
            summary=f"{event.event_no} operasyon raporu teslim edildi.",
            context=context,
        )
    db.commit()
    db.refresh(report)
    return report
