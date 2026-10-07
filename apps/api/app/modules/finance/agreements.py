"""Anlaşma (etkinlik) ile finans arasındaki bağ.

Anlaşma anında:
- Müşteri borcu (KDV dahil) ↔ gelir (KDV hariç) + ödenecek KDV kaydedilir,
- Maliyeti olan her etkinlik kalemi için sanatçı/tedarikçi borcu açılır,
- Ödeme planı (kapora + kalan) oluşturulur.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import DomainError
from app.core.money import Currency, format_money, money
from app.modules.catalog.models import ServiceItem
from app.modules.closing.service import ensure_event_open
from app.modules.events.models import Event
from app.modules.finance import ledger
from app.modules.finance.ledger import Leg
from app.modules.finance.models import (
    Account,
    DocStatus,
    EntryKind,
    JournalEntry,
    JournalLine,
    Payable,
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
    kept = set(
        db.scalars(
            select(Payable.event_item_id).where(
                Payable.event_id == event.id, Payable.status == DocStatus.ACTIVE
            )
        )
    )
    for item in event.items:
        if item.line_type == LineType.PACKAGE or item.unit_cost <= 0 or item.id in kept:
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

CANCEL_KINDS = (EntryKind.CANCEL_REFUND, EntryKind.CANCEL_KEPT, EntryKind.CANCEL_RELEASE)


@dataclass(frozen=True)
class CancelRefund:
    """İstisnai iade: alınan paranın bir kısmı veya tamamı müşteriye geri ödenir."""

    amount: Decimal
    cash_account_id: int
    refund_date: date | None = None
    rate: Decimal | None = None


def _active_entries_for(
    db: Session,
    *,
    event_id: int | None = None,
    payable_id: int | None = None,
    kinds: tuple[EntryKind, ...] = (EntryKind.AGREEMENT,),
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
        query = query.where(JournalEntry.event_id == event_id, JournalEntry.kind.in_(kinds))
    return list(db.scalars(query.order_by(JournalEntry.id)))


def reverse_payable(db: Session, payable: Payable, reason: str, actor: User | None) -> None:
    for entry in _active_entries_for(db, payable_id=payable.id):
        if entry.kind in {EntryKind.PAYABLE, EntryKind.PAYABLE_ADJUSTMENT}:
            ledger.reverse(db, entry, description=f"İptal: {entry.description}", actor=actor)
    payable.status = DocStatus.CANCELLED
    payable.cancel_reason = reason


def _release_unpaid(db: Session, payable: Payable, paid: Decimal, actor: User | None) -> None:
    """Kısmen ödenmiş borcun ödenmemiş kısmı düşülür; ödenen kısım maliyet olarak kalır."""
    unpaid = money(payable.amount - paid)
    ledger.post(
        db,
        kind=EntryKind.CANCEL_RELEASE,
        entry_date=clock.today(),
        description=f"İptal: {payable.title} borcunun ödenmemiş kısmı düşüldü",
        legs=[
            ledger.leg(
                Account.SUPPLIER_PAYABLE,
                unpaid,
                payable.currency,
                payable.rate,
                payable_id=payable.id,
                event_id=payable.event_id,
            ),
            ledger.leg(
                Account.EVENT_COST,
                unpaid,
                payable.currency,
                payable.rate,
                credit=True,
                event_id=payable.event_id,
            ),
        ],
        actor=actor,
        event_id=payable.event_id,
    )
    payable.amount = paid


def _receivable(db: Session, event: Event) -> tuple[Decimal, Decimal]:
    """Etkinliğin müşteri alacağı: (etkinlik dövizinde tutar, TL karşılığı)."""
    amount = ledger.amount_balance(
        db, Account.CUSTOMER_RECEIVABLE, event_id=event.id, currency=event.currency
    ).get(event.currency, Decimal("0"))
    base = ledger.balance(db, Account.CUSTOMER_RECEIVABLE, event_id=event.id)
    return amount, base


def _post_refund(db: Session, event: Event, refund: CancelRefund, actor: User | None) -> None:
    from app.modules.finance import common  # noqa: PLC0415

    owed, owed_base = _receivable(db, event)  # iptalden sonra müşteriye borç: eksi
    refund_date = refund.refund_date or clock.today()
    common.check_date(refund_date)
    account = common.get_cash_account(db, refund.cash_account_id, event.currency)
    rate = common.require_rate(event.currency, refund.rate)
    common.assert_cash_available(db, account, refund.amount, refund_date)
    # Tamamı iade ediliyorsa kalan TL karşılığının hepsi kapanır (kuruş farkı kalmaz).
    full = refund.amount == -owed
    base = -owed_base if full else money(-owed_base * refund.amount / -owed)
    legs = [
        Leg(
            Account.CUSTOMER_RECEIVABLE,
            base,
            refund.amount,
            Currency(event.currency),
            event.exchange_rate,
            customer_id=event.customer_id,
            event_id=event.id,
        ),
        ledger.leg(
            Account.CASH,
            refund.amount,
            event.currency,
            rate,
            credit=True,
            cash_account_id=account.id,
            event_id=event.id,
        ),
    ]
    fx = ledger.balancing_fx_leg(legs, event_id=event.id)
    if fx:
        legs.append(fx)
    ledger.post(
        db,
        kind=EntryKind.CANCEL_REFUND,
        entry_date=refund_date,
        description=f"İptal iadesi: {event.event_no} {event.title} → {account.name}",
        legs=legs,
        actor=actor,
        event_id=event.id,
    )


def _post_kept(db: Session, event: Event, actor: User | None) -> None:
    owed, owed_base = _receivable(db, event)
    if owed >= 0:
        return
    ledger.post(
        db,
        kind=EntryKind.CANCEL_KEPT,
        entry_date=clock.today(),
        description=f"İptal: {event.event_no} kaporası şirkette kaldı",
        legs=[
            Leg(
                Account.CUSTOMER_RECEIVABLE,
                -owed_base,
                -owed,
                Currency(event.currency),
                event.exchange_rate,
                customer_id=event.customer_id,
                event_id=event.id,
            ),
            Leg(
                Account.REVENUE,
                owed_base,
                owed,
                Currency(event.currency),
                event.exchange_rate,
                event_id=event.id,
                memo="İptal: şirkette kalan kapora",
            ),
        ],
        actor=actor,
        event_id=event.id,
    )


def cancel_settlement(db: Session, event_id: int) -> tuple[Decimal, Decimal]:
    """İptalde şirkette kalan ve müşteriye iade edilen tutarlar (etkinlik dövizinde)."""
    kept = refunded = Decimal("0")
    kinds = (EntryKind.CANCEL_KEPT, EntryKind.CANCEL_REFUND)
    for entry in _active_entries_for(db, event_id=event_id, kinds=kinds):
        amount = sum(
            (ln.amount for ln in entry.lines if ln.account == Account.CUSTOMER_RECEIVABLE),
            Decimal("0"),
        )
        if entry.kind == EntryKind.CANCEL_KEPT:
            kept += amount
        else:
            refunded += amount
    return money(kept), money(refunded)


def on_event_cancel(
    db: Session,
    event: Event,
    reason: str,
    actor: User | None,
    refund: CancelRefund | None = None,
) -> None:
    """Etkinlik iptali. Alınan para varsayılan olarak şirkette kalır (kapora geri verilmez);
    istisnai durumda bir kısmı veya tamamı iade edilir. Sanatçı/tedarikçiye yapılmış ödemeler
    maliyet olarak kalır, ödenmemiş borçlar iptal edilir."""
    from app.modules.finance.collections import (  # noqa: PLC0415
        collected_amount,
        written_off_amount,
    )
    from app.modules.finance.payables import paid_amount  # noqa: PLC0415

    ensure_event_open(db, event.id)
    if written_off_amount(db, event.id) > 0:
        raise DomainError("Alacağı silinmiş etkinlik iptal edilemez.")
    collected = collected_amount(db, event.id)
    if refund is not None and refund.amount <= 0:
        refund = None
    if refund is not None and refund.amount > collected:
        raise DomainError(
            f"İade, alınan paradan ({format_money(collected, event.currency)}) fazla olamaz."
        )
    for payable in db.scalars(
        select(Payable).where(Payable.event_id == event.id, Payable.status == DocStatus.ACTIVE)
    ):
        paid = paid_amount(db, payable.id)
        if paid <= 0:
            reverse_payable(db, payable, reason, actor)
        elif paid < payable.amount:
            _release_unpaid(db, payable, paid, actor)
    for entry in _active_entries_for(db, event_id=event.id):
        ledger.reverse(db, entry, description=f"İptal: {entry.description}", actor=actor)
    if refund is not None:
        _post_refund(db, event, refund, actor)
    _post_kept(db, event, actor)


def on_event_reopen(db: Session, event: Event, actor: User | None) -> None:
    """İptal edilmiş etkinlik yeniden açılırsa iptal kayıtları geri alınır; anlaşma kaydı ve
    iptal edilen borçlar yeniden oluşturulur."""
    if _active_entries_for(db, event_id=event.id):
        return
    for entry in reversed(_active_entries_for(db, event_id=event.id, kinds=CANCEL_KINDS)):
        if entry.kind == EntryKind.CANCEL_RELEASE:
            for line in entry.lines:
                if line.account == Account.SUPPLIER_PAYABLE and line.payable_id:
                    payable = db.get(Payable, line.payable_id)
                    payable.amount = money(payable.amount + line.amount)  # type: ignore[union-attr]
        ledger.reverse(db, entry, description=f"Yeniden açıldı: {entry.description}", actor=actor)
    entry = post_agreement(db, event, actor)
    create_item_payables(db, event, actor, entry.entry_date)
