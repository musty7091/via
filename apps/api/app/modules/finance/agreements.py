"""Anlaşma (etkinlik) ile finans arasındaki bağ.

Anlaşma anında:
- Müşteri borcu (KDV dahil) ↔ gelir (KDV hariç) + ödenecek KDV kaydedilir,
- Maliyeti olan her etkinlik kalemi için sanatçı/tedarikçi borcu açılır,
- Ödeme planı (kapora + kalan) oluşturulur.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import DomainError
from app.core.money import Currency, money
from app.modules.catalog.models import ServiceItem
from app.modules.closing.service import ensure_event_open
from app.modules.events.models import Event
from app.modules.finance import ledger
from app.modules.finance.ledger import Leg
from app.modules.finance.models import (
    Account,
    Collection,
    DocStatus,
    EntryKind,
    JournalEntry,
    JournalLine,
    Payable,
    PayablePayment,
    PaymentPlan,
)
from app.modules.offers.models import LineType
from app.modules.users.models import User


def post_agreement(db: Session, event: Event, actor: User | None) -> JournalEntry:
    rate = event.exchange_rate
    receivable = money(event.total_amount * rate)
    revenue = money(event.net_amount * rate)
    parties = {"customer_id": event.customer_id, "event_id": event.id}
    legs = [
        Leg(
            Account.CUSTOMER_RECEIVABLE,
            receivable,
            event.total_amount,
            event.currency,
            rate,
            **parties,
        ),
        Leg(Account.REVENUE, -revenue, -event.net_amount, event.currency, rate, event_id=event.id),
    ]
    if receivable != revenue:
        # KDV'nin TL karşılığı, yuvarlama farkı kalmasın diye farktan bulunur.
        legs.append(
            Leg(
                Account.VAT_PAYABLE,
                revenue - receivable,
                -event.vat_amount,
                event.currency,
                rate,
                event_id=event.id,
            )
        )
    return ledger.post(
        db,
        kind=EntryKind.AGREEMENT,
        entry_date=clock.today(),
        description=f"{event.event_no} anlaşması: {event.title}",
        legs=legs,
        actor=actor,
        event_id=event.id,
    )


def post_payable(
    db: Session, payable: Payable, actor: User | None, entry_date: date
) -> JournalEntry:
    cost_account = Account.EVENT_COST if payable.event_id else Account.EXPENSE
    return ledger.post(
        db,
        kind=EntryKind.PAYABLE,
        entry_date=entry_date,
        description=f"Borç: {payable.title}",
        legs=[
            ledger.leg(
                cost_account,
                payable.amount,
                payable.currency,
                payable.rate,
                event_id=payable.event_id,
            ),
            ledger.leg(
                Account.SUPPLIER_PAYABLE,
                payable.amount,
                payable.currency,
                payable.rate,
                credit=True,
                payable_id=payable.id,
                event_id=payable.event_id,
            ),
        ],
        actor=actor,
        event_id=payable.event_id,
    )


def create_item_payables(
    db: Session, event: Event, actor: User | None, entry_date: date
) -> list[Payable]:
    payables = []
    for item in event.items:
        if item.line_type == LineType.PACKAGE or item.unit_cost <= 0:
            continue
        supplier_id = None
        if item.service_id:
            service = db.get(ServiceItem, item.service_id)
            supplier_id = service.supplier_id if service else None
        payable = Payable(
            event_id=event.id,
            event_item_id=item.id,
            artist_id=item.artist_id,
            supplier_id=supplier_id,
            title=item.title,
            amount=money(item.quantity * item.unit_cost),
            currency=Currency(item.cost_currency),
            rate=item.cost_rate,
            due_date=event.event_date,
        )
        db.add(payable)
        db.flush()
        post_payable(db, payable, actor, entry_date)
        payables.append(payable)
    return payables


def create_payment_plan(db: Session, event: Event) -> None:
    today = clock.today()
    due_final = max(event.event_date, today)
    if event.advance_amount > 0:
        db.add(
            PaymentPlan(
                event_id=event.id,
                title="Kapora",
                due_date=today,
                amount=event.advance_amount,
                sort_order=1,
            )
        )
        remaining = money(event.total_amount - event.advance_amount)
        if remaining > 0:
            db.add(
                PaymentPlan(
                    event_id=event.id,
                    title="Kalan ödeme",
                    due_date=due_final,
                    amount=remaining,
                    sort_order=2,
                )
            )
    else:
        db.add(
            PaymentPlan(
                event_id=event.id,
                title="Ödeme",
                due_date=due_final,
                amount=event.total_amount,
                sort_order=1,
            )
        )


def on_agreement(db: Session, event: Event, actor: User | None) -> None:
    """Teklif anlaşmaya çevrildiğinde (aynı transaction içinde) çağrılır."""
    entry = post_agreement(db, event, actor)
    create_item_payables(db, event, actor, entry.entry_date)
    create_payment_plan(db, event)


# --- Etkinlik iptali ---


def _active_entries_for(
    db: Session, *, event_id: int | None = None, payable_id: int | None = None
) -> list[JournalEntry]:
    """İlgili, henüz ters kaydı yapılmamış ve kendisi ters kayıt olmayan fişler."""
    reversed_ids = select(JournalEntry.reverses_id).where(JournalEntry.reverses_id.is_not(None))
    query = select(JournalEntry).where(
        JournalEntry.kind != EntryKind.REVERSAL, JournalEntry.id.not_in(reversed_ids)
    )
    if payable_id is not None:
        line_entries = select(JournalLine.entry_id).where(JournalLine.payable_id == payable_id)
        query = query.where(JournalEntry.id.in_(line_entries))
    if event_id is not None:
        query = query.where(
            JournalEntry.event_id == event_id, JournalEntry.kind == EntryKind.AGREEMENT
        )
    return list(db.scalars(query.order_by(JournalEntry.id)))


def reverse_payable(db: Session, payable: Payable, reason: str, actor: User | None) -> None:
    for entry in _active_entries_for(db, payable_id=payable.id):
        if entry.kind in {EntryKind.PAYABLE, EntryKind.PAYABLE_ADJUSTMENT}:
            ledger.reverse(
                db,
                entry,
                entry_date=clock.today(),
                description=f"İptal: {entry.description}",
                actor=actor,
            )
    payable.status = DocStatus.CANCELLED
    payable.cancel_reason = reason


def on_event_cancel(db: Session, event: Event, reason: str, actor: User | None) -> None:
    ensure_event_open(db, event.id)
    has_collection = db.scalar(
        select(Collection.id).where(
            Collection.event_id == event.id, Collection.status == DocStatus.ACTIVE
        )
    )
    has_payment = db.scalar(
        select(PayablePayment.id)
        .join(Payable)
        .where(Payable.event_id == event.id, PayablePayment.status == DocStatus.ACTIVE)
    )
    if has_collection or has_payment:
        raise DomainError(
            "Etkinlikte aktif tahsilat veya sanatçı/tedarikçi ödemesi var. "
            "İptalden önce bunları iptal edin veya iade kaydı girin."
        )
    for entry in _active_entries_for(db, event_id=event.id):
        ledger.reverse(
            db,
            entry,
            entry_date=clock.today(),
            description=f"İptal: {entry.description}",
            actor=actor,
        )
    for payable in db.scalars(
        select(Payable).where(Payable.event_id == event.id, Payable.status == DocStatus.ACTIVE)
    ):
        reverse_payable(db, payable, reason, actor)


def on_event_reopen(db: Session, event: Event, actor: User | None) -> None:
    """İptal edilmiş etkinlik yeniden açılırsa anlaşma kayıtları yeniden oluşturulur."""
    if _active_entries_for(db, event_id=event.id):
        return
    entry = post_agreement(db, event, actor)
    create_item_payables(db, event, actor, entry.entry_date)
