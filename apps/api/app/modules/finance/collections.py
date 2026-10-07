"""Müşteri tahsilatları."""

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import RequestContext
from app.core.errors import DomainError, NotFoundError
from app.core.money import Currency, format_money, money
from app.core.sequences import next_number
from app.modules.audit import service as audit
from app.modules.closing.service import ensure_event_open
from app.modules.events.models import Event, EventStatus
from app.modules.finance import common, ledger
from app.modules.finance.ledger import Leg
from app.modules.finance.models import (
    Account,
    Collection,
    DocStatus,
    EntryKind,
    JournalEntry,
    PaymentMethod,
    ReceivableWriteOff,
)
from app.modules.users.models import User


def collected_amount(db: Session, event_id: int) -> Decimal:
    """Etkinlik para biriminde tahsil edilen toplam (aktif tahsilatlar)."""
    total = db.scalar(
        select(func.coalesce(func.sum(Collection.applied_amount), 0)).where(
            Collection.event_id == event_id, Collection.status == DocStatus.ACTIVE
        )
    )
    return money(total)


def written_off_amount(db: Session, event_id: int) -> Decimal:
    """Etkinlik para biriminde silinen (tahsil edilemeyen) alacak."""
    total = db.scalar(
        select(func.coalesce(func.sum(ReceivableWriteOff.amount), 0)).where(
            ReceivableWriteOff.event_id == event_id, ReceivableWriteOff.status == DocStatus.ACTIVE
        )
    )
    return money(total)


def remaining_amount(db: Session, event: Event) -> Decimal:
    return money(
        event.total_amount - collected_amount(db, event.id) - written_off_amount(db, event.id)
    )


def get_collection(db: Session, collection_id: int) -> Collection:
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise NotFoundError("Tahsilat bulunamadı.")
    return collection


def create_collection(
    db: Session,
    *,
    event: Event,
    collection_date: date,
    amount: Decimal,
    currency: Currency,
    rate: Decimal | None,
    applied_amount: Decimal | None,
    cash_account_id: int | None,
    partner_id: int | None,
    method: PaymentMethod,
    document_no: str | None,
    note: str | None,
    actor: User,
    context: RequestContext,
) -> Collection:
    if event.status == EventStatus.CANCELLED:
        raise DomainError("İptal edilmiş etkinliğe tahsilat girilemez.")
    ensure_event_open(db, event.id)
    if (cash_account_id is None) == (partner_id is None):
        raise DomainError("Paranın girdiği yeri seçin: şirket kasası/bankası veya ortak.")
    if amount <= 0:
        raise DomainError("Tahsilat tutarı sıfırdan büyük olmalıdır.")
    common.check_date(collection_date)
    rate = common.require_rate(currency, rate)

    if currency == event.currency:
        applied = amount
    elif applied_amount is None or applied_amount <= 0:
        raise DomainError(
            f"Tahsilat {currency}, etkinlik {event.currency}. "
            f"Bu tahsilatın karşıladığı {event.currency} tutarını girin."
        )
    else:
        applied = applied_amount

    remaining = remaining_amount(db, event)
    if applied > remaining:
        raise DomainError(
            f"Müşterinin bu etkinlikten kalan borcu {format_money(remaining, event.currency)}; "
            "fazla tahsilat girilemez."
        )

    if cash_account_id is not None:
        account = common.get_cash_account(db, cash_account_id, currency)
        destination = ledger.leg(
            Account.CASH, amount, currency, rate, cash_account_id=account.id, event_id=event.id
        )
        where = account.name
    else:
        partner = common.get_partner(db, partner_id)  # type: ignore[arg-type]
        destination = ledger.leg(
            Account.PARTNER_CASH, amount, currency, rate, partner_id=partner.id, event_id=event.id
        )
        where = f"{partner.full_name} (ortak üzerinde)"

    # Müşteri borcu anlaşma kuruyla kapanır; son tahsilatta kalan TL karşılığının tamamı kapanır.
    receivable_base = ledger.balance(
        db, Account.CUSTOMER_RECEIVABLE, customer_id=event.customer_id, event_id=event.id
    )
    credit_base = receivable_base if applied == remaining else money(applied * event.exchange_rate)
    receivable = Leg(
        Account.CUSTOMER_RECEIVABLE,
        -credit_base,
        -applied,
        Currency(event.currency),
        event.exchange_rate,
        customer_id=event.customer_id,
        event_id=event.id,
    )
    legs = [destination, receivable]
    fx = ledger.balancing_fx_leg(legs, event_id=event.id)
    if fx:
        legs.append(fx)

    entry = ledger.post(
        db,
        kind=EntryKind.COLLECTION,
        entry_date=collection_date,
        description=f"Tahsilat: {event.event_no} {event.title} → {where}",
        legs=legs,
        actor=actor,
        event_id=event.id,
    )
    collection = Collection(
        collection_no=next_number(db, "collection", collection_date.year, "VIA-TH"),
        event_id=event.id,
        customer_id=event.customer_id,
        collection_date=collection_date,
        amount=money(amount),
        currency=currency,
        rate=rate,
        applied_amount=money(applied),
        cash_account_id=cash_account_id,
        partner_id=partner_id,
        method=method,
        document_no=document_no,
        note=note,
        entry_id=entry.id,
        created_by_id=actor.id,
    )
    db.add(collection)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="collection.create",
        entity_type="event",
        entity_id=event.id,
        summary=f"{collection.collection_no}: {format_money(amount, currency)} tahsilat → {where}.",
        context=context,
    )
    db.commit()
    db.refresh(collection)
    return collection


def cancel_collection(
    db: Session, collection: Collection, reason: str, *, actor: User, context: RequestContext
) -> Collection:
    if collection.status != DocStatus.ACTIVE:
        raise DomainError("Bu tahsilat zaten iptal edilmiş.")
    if collection.event and collection.event.status == EventStatus.CANCELLED:
        raise DomainError(
            "İptal edilmiş etkinliğin tahsilatı iptal edilemez; önce etkinliği yeniden açın."
        )
    ensure_event_open(db, collection.event_id)
    if not reason:
        raise DomainError("İptal sebebini yazın.")
    # Para kasadan/ortaktan geri çıkacağı için bakiye yetmeli (eski sistemdeki eksi bakiye hatası).
    # Kasa tarafı ters kayıtta (ledger.reverse) iptal tarihinden bugüne her gün için denetlenir.
    if collection.cash_account_id is None:
        held, _ = common.carrying(
            db, Account.PARTNER_CASH, collection.currency, partner_id=collection.partner_id
        )
        if collection.amount > held:
            raise DomainError(
                f"{collection.partner.full_name} bu parayı kasaya teslim etmiş görünüyor "  # type: ignore[union-attr]
                f"(ortak üzerinde kalan {format_money(held, collection.currency)}). "
                "Önce teslim kaydını iptal edin."
            )
    entry = db.get(JournalEntry, collection.entry_id)
    ledger.reverse(
        db,
        entry,  # type: ignore[arg-type]
        description=f"Tahsilat iptali: {collection.collection_no}. Sebep: {reason}",
        actor=actor,
    )
    collection.status = DocStatus.CANCELLED
    collection.cancel_reason = reason
    audit.record(
        db,
        actor=actor,
        action="collection.cancel",
        entity_type="event",
        entity_id=collection.event_id,
        summary=f"{collection.collection_no} tahsilatı iptal edildi. Sebep: {reason}",
        context=context,
    )
    db.commit()
    db.refresh(collection)
    return collection
