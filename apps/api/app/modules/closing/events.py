"""Etkinlik finans kapanışı.

Kural (sahibin kararı): kâr, etkinlik gerçekleşip müşteri alacağı tamamen kapandığında
(tahsil edildiğinde veya gerekçeyle silindiğinde) dağıtılabilir. Gerçekleşen kâr/zarar
aktif ortaklara eşit bölünür.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.deps import RequestContext
from app.core.errors import DomainError, NotFoundError
from app.core.money import format_money, money
from app.core.schemas import ApiModel, columns
from app.modules.audit import service as audit
from app.modules.closing.distribution import post_distribution, preview_shares
from app.modules.closing.models import ClosureStatus, EventClosure
from app.modules.closing.service import ensure_event_open
from app.modules.events.models import Event, EventStatus
from app.modules.finance import ledger
from app.modules.finance.collections import remaining_amount
from app.modules.finance.ledger import Leg
from app.modules.finance.models import (
    Account,
    DocStatus,
    EntryKind,
    JournalEntry,
    Payable,
    ReceivableWriteOff,
)
from app.modules.finance.payables import paid_amount
from app.modules.operations.models import OperationReport, ReportStatus
from app.modules.users.models import User


class CheckItem(ApiModel):
    key: str
    label: str
    ok: bool
    detail: str | None = None
    blocking: bool = True


class ShareRead(ApiModel):
    partner_id: int
    name: str
    share: Decimal


class ClosureRead(ApiModel):
    id: int
    status: ClosureStatus
    closed_at: datetime
    revenue: Decimal
    cost: Decimal
    expense: Decimal
    fx: Decimal
    profit: Decimal
    shares: list[ShareRead]
    note: str | None
    reopened_at: datetime | None
    reopen_reason: str | None


class ClosurePreview(ApiModel):
    event_id: int
    can_close: bool
    checks: list[CheckItem]
    revenue: Decimal
    cost: Decimal
    expense: Decimal
    fx: Decimal
    profit: Decimal
    shares: list[ShareRead]
    active_closure: ClosureRead | None
    history: list[ClosureRead]


def _result(db: Session, event_id: int) -> dict[str, Decimal]:
    revenue = -ledger.balance(db, Account.REVENUE, event_id=event_id)
    cost = ledger.balance(db, Account.EVENT_COST, event_id=event_id)
    expense = ledger.balance(db, Account.EXPENSE, event_id=event_id)
    fx = -ledger.balance(db, Account.FX_DIFFERENCE, event_id=event_id)
    return {
        "revenue": revenue,
        "cost": cost,
        "expense": expense,
        "fx": fx,
        "profit": money(revenue - cost - expense + fx),
    }


def active_closure(db: Session, event_id: int) -> EventClosure | None:
    return db.scalar(
        select(EventClosure).where(
            EventClosure.event_id == event_id, EventClosure.status == ClosureStatus.CLOSED
        )
    )


def closure_read(closure: EventClosure) -> ClosureRead:
    return ClosureRead.model_validate(
        {**columns(closure), "shares": [ShareRead(**s) for s in closure.shares]}
    )


def checks(db: Session, event: Event) -> list[CheckItem]:
    remaining = remaining_amount(db, event)
    open_payables = [
        p
        for p in db.scalars(
            select(Payable).where(Payable.event_id == event.id, Payable.status == DocStatus.ACTIVE)
        )
        if paid_amount(db, p.id) < p.amount
    ]
    report = db.scalar(select(OperationReport.status).where(OperationReport.event_id == event.id))
    return [
        CheckItem(
            key="completed",
            label="Etkinlik gerçekleşti olarak işaretlendi",
            ok=event.status == EventStatus.COMPLETED,
            detail=None
            if event.status == EventStatus.COMPLETED
            else "Önce etkinliği 'Gerçekleşti' yapın.",
        ),
        CheckItem(
            key="collected",
            label="Müşteri alacağı tamamen kapandı",
            ok=remaining == 0,
            detail=None
            if remaining == 0
            else (
                f"Kalan {format_money(remaining, event.currency)}. "
                "Tahsil edin veya tahsil edilemeyecekse silin."
            ),
        ),
        CheckItem(
            key="payables",
            label="Sanatçı / tedarikçi borçları ödendi",
            ok=not open_payables,
            detail=None
            if not open_payables
            else (
                f"{len(open_payables)} borç açık. "
                "Maliyet kârdan düşüldü; kapanış sonrası da ödenebilir."
            ),
            blocking=False,
        ),
        CheckItem(
            key="operation_report",
            label="Operasyon raporu teslim edildi",
            ok=report == ReportStatus.SUBMITTED,
            detail=None
            if report == ReportStatus.SUBMITTED
            else "Operasyon ekibi etkinlik raporunu henüz teslim etmedi.",
            blocking=False,
        ),
    ]


def preview(db: Session, event: Event) -> ClosurePreview:
    items = checks(db, event)
    result = _result(db, event.id)
    active = active_closure(db, event.id)
    history = db.scalars(
        select(EventClosure)
        .where(EventClosure.event_id == event.id)
        .order_by(EventClosure.id.desc())
    ).all()
    return ClosurePreview(
        event_id=event.id,
        can_close=active is None and all(i.ok for i in items if i.blocking),
        checks=items,
        **result,
        shares=[ShareRead(**s) for s in preview_shares(db, result["profit"])],
        active_closure=closure_read(active) if active else None,
        history=[closure_read(c) for c in history],
    )


def write_off(
    db: Session, event: Event, reason: str, *, actor: User, context: RequestContext
) -> ReceivableWriteOff:
    """Tahsil edilemeyen alacağı gider olarak kapatır (etkinlik kârından düşer)."""
    ensure_event_open(db, event.id)
    if event.status == EventStatus.CANCELLED:
        raise DomainError("İptal edilmiş etkinlikte alacak silinemez.")
    if not reason or len(reason.strip()) < 3:
        raise DomainError("Gerekçe yazın.")
    remaining = remaining_amount(db, event)
    if remaining <= 0:
        raise DomainError("Silinecek kalan alacak yok.")
    base = ledger.balance(
        db, Account.CUSTOMER_RECEIVABLE, customer_id=event.customer_id, event_id=event.id
    )
    entry = ledger.post(
        db,
        kind=EntryKind.WRITE_OFF,
        entry_date=clock.today(),
        description=f"Tahsil edilemeyen alacak: {event.event_no}. Gerekçe: {reason}",
        legs=[
            Leg(
                Account.EXPENSE,
                base,
                base,
                "TRY",
                Decimal("1"),
                event_id=event.id,
                memo="Tahsil edilemeyen alacak",
            ),
            Leg(
                Account.CUSTOMER_RECEIVABLE,
                -base,
                -remaining,
                event.currency,
                event.exchange_rate,
                customer_id=event.customer_id,
                event_id=event.id,
            ),
        ],
        actor=actor,
        event_id=event.id,
    )
    doc = ReceivableWriteOff(
        event_id=event.id,
        amount=remaining,
        reason=reason,
        entry_id=entry.id,
        created_by_id=actor.id,
    )
    db.add(doc)
    audit.record(
        db,
        actor=actor,
        action="event.write_off",
        entity_type="event",
        entity_id=event.id,
        summary=(
            f"{event.event_no}: {format_money(remaining, event.currency)} alacak silindi. "
            f"Gerekçe: {reason}"
        ),
        context=context,
    )
    db.commit()
    db.refresh(doc)
    return doc


def close_event(
    db: Session, event: Event, note: str | None, *, actor: User, context: RequestContext
) -> EventClosure:
    if active_closure(db, event.id):
        raise DomainError("Bu etkinliğin finans kapanışı zaten yapılmış.")
    failing = [i for i in checks(db, event) if i.blocking and not i.ok]
    if failing:
        raise DomainError("Kapanış yapılamaz: " + " ".join(i.detail or i.label for i in failing))
    result = _result(db, event.id)
    profit = result["profit"]
    kind_label = "kâr" if profit >= 0 else "zarar"
    entry, shares = post_distribution(
        db,
        amount=profit,
        kind=EntryKind.EVENT_CLOSE,
        entry_date=clock.today(),
        description=f"{event.event_no} finans kapanışı: {kind_label} dağıtımı",
        actor=actor,
        event_id=event.id,
    )
    closure = EventClosure(
        event_id=event.id,
        status=ClosureStatus.CLOSED,
        closed_at=clock.now(),
        closed_by_id=actor.id,
        **result,
        shares=shares,
        entry_id=entry.id if entry else None,
        note=note,
    )
    db.add(closure)
    db.flush()
    share_text = ", ".join(f"{s['name']} {format_money(s['share'])}" for s in shares)
    audit.record(
        db,
        actor=actor,
        action="event.close",
        entity_type="event",
        entity_id=event.id,
        summary=(
            f"{event.event_no} finans kapanışı: {kind_label} {format_money(profit)} ({share_text})."
        ),
        context=context,
    )
    db.commit()
    db.refresh(closure)
    return closure


def reopen(
    db: Session, event: Event, reason: str, *, actor: User, context: RequestContext
) -> EventClosure:
    closure = active_closure(db, event.id)
    if closure is None:
        raise NotFoundError("Aktif finans kapanışı yok.")
    if not reason or len(reason.strip()) < 3:
        raise DomainError("Gerekçe yazın.")
    if closure.entry_id:
        entry = db.get(JournalEntry, closure.entry_id)
        ledger.reverse(
            db,
            entry,  # type: ignore[arg-type]
            entry_date=clock.today(),
            description=f"{event.event_no} finans kapanışı geri alındı. Gerekçe: {reason}",
            actor=actor,
        )
    closure.status = ClosureStatus.REOPENED
    closure.reopened_at = clock.now()
    closure.reopen_reason = reason
    audit.record(
        db,
        actor=actor,
        action="event.reopen_closure",
        entity_type="event",
        entity_id=event.id,
        summary=f"{event.event_no} finans kapanışı geri alındı. Gerekçe: {reason}",
        context=context,
    )
    db.commit()
    db.refresh(closure)
    return closure
