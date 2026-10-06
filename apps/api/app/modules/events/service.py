from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session, object_session

from app.core import clock
from app.core.deps import RequestContext
from app.core.errors import DomainError, NotFoundError
from app.core.money import Currency, money
from app.core.permissions import Permission, permissions_for
from app.core.schemas import ApiModel, LongText, blank_to_none
from app.core.text import search_pattern
from app.modules.audit import service as audit
from app.modules.closing import service as finance_closing
from app.modules.customers.models import CustomerContact, InvoicePreference, Venue
from app.modules.events.models import Event, EventStatus
from app.modules.finance import agreements as finance_agreements
from app.modules.offers.schemas import OfferLineRead, Profitability, Ref
from app.modules.offers.service import line_read, profitability
from app.modules.users.models import User

STATUS_LABELS = {
    EventStatus.PLANNED: "Planlandı",
    EventStatus.COMPLETED: "Gerçekleşti",
    EventStatus.CANCELLED: "İptal",
}


# --- Şemalar ---


class EventListItem(ApiModel):
    id: int
    event_no: str
    status: EventStatus
    title: str
    customer: Ref
    venue: Ref | None
    partner: Ref
    event_date: date
    start_time: time | None
    currency: Currency
    total_amount: Decimal
    base_total_amount: Decimal


class EventDetail(ApiModel):
    id: int
    event_no: str
    status: EventStatus
    offer_id: int
    offer_no: str
    customer: Ref
    contact: Ref | None
    contact_phone: str | None
    venue: Ref | None
    partner: Ref
    title: str
    event_date: date
    start_time: time | None
    end_time: time | None
    guest_count: int | None
    invoice_type: InvoicePreference
    vat_rate: Decimal
    currency: Currency
    exchange_rate: Decimal
    net_amount: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    advance_amount: Decimal
    remaining_amount: Decimal
    base_net_amount: Decimal
    base_total_amount: Decimal
    payment_terms: str | None
    notes: str | None
    agreed_at: datetime
    cancelled_at: datetime | None
    cancel_reason: str | None
    items: list[OfferLineRead]
    profitability: Profitability | None
    allowed_actions: list[str]


class EventUpdate(ApiModel):
    """Anlaşma tutarları burada değişmez; sadece operasyonel bilgiler."""

    event_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    venue_id: int | None = None
    contact_id: int | None = None
    guest_count: Annotated[int, Field(gt=0, le=100_000)] | None = None
    notes: LongText | None = None

    @field_validator("notes", mode="before")
    @classmethod
    def _blank(cls, value: object) -> object:
        return blank_to_none(value)


class EventAction(ApiModel):
    action: Literal["complete", "cancel", "reopen"]
    note: LongText | None = None


TRANSITIONS: dict[str, tuple[set[EventStatus], EventStatus]] = {
    "complete": ({EventStatus.PLANNED}, EventStatus.COMPLETED),
    "cancel": ({EventStatus.PLANNED}, EventStatus.CANCELLED),
    "reopen": ({EventStatus.COMPLETED, EventStatus.CANCELLED}, EventStatus.PLANNED),
}
FIELDS = list(EventUpdate.model_fields)


# --- Servis ---


def get_event(db: Session, event_id: int) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise NotFoundError("Etkinlik bulunamadı.")
    return event


def list_events(
    db: Session,
    *,
    search: str | None,
    status: EventStatus | None,
    date_from: date | None,
    date_to: date | None,
    customer_id: int | None,
    offset: int,
    limit: int,
) -> tuple[list[EventListItem], int]:
    query = select(Event)
    if search:
        query = query.where(Event.search_text.like(search_pattern(search)))
    if status:
        query = query.where(Event.status == status)
    if date_from:
        query = query.where(Event.event_date >= date_from)
    if date_to:
        query = query.where(Event.event_date <= date_to)
    if customer_id is not None:
        query = query.where(Event.customer_id == customer_id)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    # Yaklaşan etkinliklerde en yakın tarih üstte; diğer durumlarda en yeni üstte.
    upcoming = date_from is not None and date_to is None
    order = (
        (Event.event_date.asc(), Event.id.asc())
        if upcoming
        else (
            Event.event_date.desc(),
            Event.id.desc(),
        )
    )
    events = db.scalars(query.order_by(*order).offset(offset).limit(limit)).all()
    return [
        EventListItem(
            id=e.id,
            event_no=e.event_no,
            status=e.status,
            title=e.title,
            customer=Ref(id=e.customer.id, name=e.customer.name),
            venue=Ref(id=e.venue.id, name=e.venue.name) if e.venue else None,
            partner=Ref(id=e.partner.id, name=e.partner.full_name),
            event_date=e.event_date,
            start_time=e.start_time,
            currency=e.currency,
            total_amount=e.total_amount,
            base_total_amount=e.base_total_amount,
        )
        for e in events
    ], total


def _allowed_actions(event: Event, user: User) -> list[str]:
    if Permission.EVENTS_MANAGE not in permissions_for(user.role):
        return []
    actions = [name for name, (sources, _) in TRANSITIONS.items() if event.status in sources]
    # Finans kapanışı yapılmış etkinlik iptal edilemez ve yeniden açılamaz.
    if finance_closing.event_closed(object_session(event), event.id):
        actions = [a for a in actions if a not in {"cancel", "reopen"}]
    if event.status == EventStatus.PLANNED:
        actions.append("edit")
    return actions


def event_detail(event: Event, user: User) -> EventDetail:
    show_costs = Permission.COSTS_VIEW in permissions_for(user.role)
    show_money = Permission.FINANCE_VIEW in permissions_for(user.role)
    zero = Decimal("0")
    amounts = {
        "net_amount": event.net_amount,
        "vat_amount": event.vat_amount,
        "total_amount": event.total_amount,
        "advance_amount": event.advance_amount,
        "remaining_amount": money(event.total_amount - event.advance_amount),
        "base_net_amount": event.base_net_amount,
        "base_total_amount": event.base_total_amount,
    }
    if not show_money:
        # Operasyon ekibi anlaşma tutarlarını görmez.
        amounts = {key: zero for key in amounts}
    items = [line_read(item, show_costs) for item in event.items]
    if not show_money:
        for item in items:
            item.unit_price = zero
            item.line_total = zero
    return EventDetail(
        id=event.id,
        event_no=event.event_no,
        status=event.status,
        offer_id=event.offer_id,
        offer_no=event.offer.offer_no,
        customer=Ref(id=event.customer.id, name=event.customer.name),
        contact=Ref(id=event.contact.id, name=event.contact.full_name) if event.contact else None,
        contact_phone=event.contact.phone if event.contact else None,
        venue=Ref(id=event.venue.id, name=event.venue.name) if event.venue else None,
        partner=Ref(id=event.partner.id, name=event.partner.full_name),
        title=event.title,
        event_date=event.event_date,
        start_time=event.start_time,
        end_time=event.end_time,
        guest_count=event.guest_count,
        invoice_type=event.invoice_type,
        vat_rate=event.vat_rate,
        currency=event.currency,
        exchange_rate=event.exchange_rate,
        payment_terms=event.payment_terms,
        notes=event.notes,
        agreed_at=event.agreed_at,
        cancelled_at=event.cancelled_at,
        cancel_reason=event.cancel_reason,
        items=items,
        profitability=profitability(event.items, event.net_amount, event.exchange_rate)
        if show_costs
        else None,
        allowed_actions=_allowed_actions(event, user),
        **amounts,
    )


def update_event(
    db: Session, event: Event, data: EventUpdate, *, actor: User, context: RequestContext
) -> Event:
    if event.status != EventStatus.PLANNED:
        raise DomainError("Sadece planlanmış etkinlik düzenlenebilir.")
    changes = data.model_dump(exclude_unset=True)
    if "event_date" in changes and changes["event_date"] is None:
        del changes["event_date"]
    if not changes:
        return event
    if changes.get("contact_id") is not None:
        contact = db.get(CustomerContact, changes["contact_id"])
        if contact is None or contact.customer_id != event.customer_id:
            raise DomainError("Seçilen yetkili bu müşteriye ait değil.")
    if changes.get("venue_id") is not None:
        venue = db.get(Venue, changes["venue_id"])
        if venue is None or not venue.is_active:
            raise DomainError("Seçilen mekân bulunamadı veya pasif.")
    diff = audit.apply_changes(event, changes, FIELDS)
    if (event.start_time is None) != (event.end_time is None):
        raise DomainError("Başlangıç ve bitiş saati birlikte girilmelidir.")
    audit.record(
        db,
        actor=actor,
        action="event.update",
        entity_type="event",
        entity_id=event.id,
        summary=f"{event.event_no} etkinliği güncellendi.",
        changes=diff,
        context=context,
    )
    db.commit()
    db.refresh(event)
    return event


def change_status(
    db: Session,
    event: Event,
    action: str,
    note: str | None,
    *,
    actor: User,
    context: RequestContext,
) -> Event:
    sources, target = TRANSITIONS[action]
    if event.status not in sources:
        raise DomainError(
            f"'{STATUS_LABELS[event.status]}' durumundaki etkinlik için bu işlem yapılamaz."
        )
    if action == "cancel":
        if not note:
            raise DomainError("İptal sebebini yazın.")
        # Anlaşma kaydı ve açık borçlar ters kayıtla iptal edilir.
        finance_agreements.on_event_cancel(db, event, note, actor)
        event.cancelled_at = clock.now()
        event.cancel_reason = note
    if action == "reopen":
        # Finans kapanışı yapılmış etkinlik "planlandı"ya geri alınamaz.
        finance_closing.ensure_event_open(db, event.id)
        if event.status == EventStatus.CANCELLED:
            finance_agreements.on_event_reopen(db, event, actor)
        event.cancelled_at = None
        event.cancel_reason = None
    previous = event.status
    event.status = target
    audit.record(
        db,
        actor=actor,
        action=f"event.{action}",
        entity_type="event",
        entity_id=event.id,
        summary=(
            f"{event.event_no} etkinliği: {STATUS_LABELS[previous]} → {STATUS_LABELS[target]}."
            + (f" Sebep: {note}" if note else "")
        ),
        changes={"status": {"before": str(previous), "after": str(target)}},
        context=context,
    )
    db.commit()
    db.refresh(event)
    return event
