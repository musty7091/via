from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import Context, CurrentUser, DbSession, require
from app.core.permissions import Permission
from app.modules.events.service import get_event
from app.modules.operations import service
from app.modules.operations.service import (
    BoardItem,
    EventOperations,
    MyTask,
    ReportSave,
    RiderCheckCreate,
    RiderCheckUpdate,
    TaskCreate,
    TaskUpdate,
)
from app.modules.users.models import User

router = APIRouter(prefix="/operations", tags=["operations"])

Viewer = Annotated[User, Depends(require(Permission.OPERATIONS_VIEW))]
Manager = Annotated[User, Depends(require(Permission.OPERATIONS_MANAGE))]


@router.get("/board", response_model=list[BoardItem])
def board(
    db: DbSession, _: Viewer, days: Annotated[int, Query(ge=1, le=180)] = 30
) -> list[BoardItem]:
    return service.board(db, days=days)


@router.get("/my-tasks", response_model=list[MyTask])
def my_tasks(db: DbSession, user: CurrentUser) -> list[MyTask]:
    return service.my_tasks(db, user)


@router.get("/events/{event_id}", response_model=EventOperations)
def event_operations(event_id: int, db: DbSession, user: Viewer) -> EventOperations:
    return service.event_operations(db, get_event(db, event_id), user)


@router.post(
    "/events/{event_id}/tasks", response_model=EventOperations, status_code=status.HTTP_201_CREATED
)
def create_task(event_id: int, data: TaskCreate, db: DbSession, user: Manager) -> EventOperations:
    event = get_event(db, event_id)
    service.create_task(db, event, data)
    return service.event_operations(db, event, user)


@router.patch("/tasks/{task_id}", response_model=EventOperations)
def update_task(task_id: int, data: TaskUpdate, db: DbSession, user: Manager) -> EventOperations:
    task = service.get_task(db, task_id)
    service.update_task(db, task, data, actor=user)
    return service.event_operations(db, get_event(db, task.event_id), user)


@router.delete("/tasks/{task_id}", response_model=EventOperations)
def delete_task(task_id: int, db: DbSession, user: Manager) -> EventOperations:
    task = service.get_task(db, task_id)
    event_id = task.event_id
    service.delete_task(db, task)
    return service.event_operations(db, get_event(db, event_id), user)


@router.post(
    "/events/{event_id}/rider-checks",
    response_model=EventOperations,
    status_code=status.HTTP_201_CREATED,
)
def create_rider_check(
    event_id: int, data: RiderCheckCreate, db: DbSession, user: Manager
) -> EventOperations:
    event = get_event(db, event_id)
    service.create_rider_check(db, event, data)
    return service.event_operations(db, event, user)


@router.post("/events/{event_id}/rider-checks/sync", response_model=EventOperations)
def sync_rider_checks(event_id: int, db: DbSession, user: Manager) -> EventOperations:
    event = get_event(db, event_id)
    service.sync_from_catalog(db, event)
    return service.event_operations(db, event, user)


@router.patch("/rider-checks/{check_id}", response_model=EventOperations)
def update_rider_check(
    check_id: int, data: RiderCheckUpdate, db: DbSession, user: Manager, context: Context
) -> EventOperations:
    check = service.get_rider_check(db, check_id)
    service.update_rider_check(db, check, data, actor=user, context=context)
    return service.event_operations(db, get_event(db, check.event_id), user)


@router.put("/events/{event_id}/report", response_model=EventOperations)
def save_report(
    event_id: int, data: ReportSave, db: DbSession, user: Manager, context: Context
) -> EventOperations:
    event = get_event(db, event_id)
    service.save_report(db, event, data, actor=user, context=context)
    return service.event_operations(db, event, user)
