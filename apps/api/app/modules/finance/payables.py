"""Sanatçı/tedarikçi borçları ve ödemeleri."""

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.deps import RequestContext
from app.core.errors import DomainError, NotFoundError
from app.core.money import Currency, money
from app.core.sequences import next_number
from app.modules.audit import service as audit
from app.modules.catalog.models import Artist, Supplier
from app.modules.closing.service import ensure_event_open, event_closed
from app.modules.events.models import Event, EventStatus
from app.modules.finance import common, ledger
from app.modules.finance.agreements import post_payable, reverse_payable
from app.modules.finance.ledger import Leg
from app.modules.finance.models import (
    Account,
    DocStatus,
    EntryKind,
    JournalEntry,
    Payable,
    PayablePayment,
    PaymentMethod,
)
from app.modules.users.models import User


def paid_amount(db: Session, payable_id: int) -> Decimal:
    total = db.scalar(
        select(func.coalesce(func.sum(PayablePayment.applied_amount), 0)).where(
            PayablePayment.payable_id == payable_id, PayablePayment.status == DocStatus.ACTIVE
        )
    )
    return money(total)


def get_payable(db: Session, payable_id: int) -> Payable:
    payable = db.get(Payable, payable_id)
    if payable is None:
        raise NotFoundError("Borç kaydı bulunamadı.")
    return payable


def payee_name(payable: Payable) -> str | None:
    if payable.artist:
        return payable.artist.name
    if payable.supplier:
        return payable.supplier.name
    return None


def _check_payee(db: Session, artist_id: int | None, supplier_id: int | None) -> None:
    if artist_id and supplier_id:
        raise DomainError("Borç ya sanatçıya ya da tedarikçiye ait olmalıdır.")
    if artist_id and db.get(Artist, artist_id) is None:
        raise DomainError("Sanatçı bulunamadı.")
    if supplier_id and db.get(Supplier, supplier_id) is None:
        raise DomainError("Tedarikçi bulunamadı.")


def create_payable(
    db: Session,
    *,
    event: Event,
    title: str,
    amount: Decimal,
    currency: Currency,
    rate: Decimal | None,
    artist_id: int | None,
    supplier_id: int | None,
    due_date: date | None,
    note: str | None,
    actor: User,
    context: RequestContext,
) -> Payable:
    """Anlaşmada öngörülmeyen ek etkinlik maliyeti (ör. ek ses ekipmanı)."""
    if event.status == EventStatus.CANCELLED:
        raise DomainError("İptal edilmiş etkinliğe borç eklenemez.")
    ensure_event_open(db, event.id)
    if amount <= 0:
        raise DomainError("Tutar sıfırdan büyük olmalıdır.")
    _check_payee(db, artist_id, supplier_id)
    payable = Payable(
        event_id=event.id,
        artist_id=artist_id,
        supplier_id=supplier_id,
        title=title,
        amount=money(amount),
        currency=currency,
        rate=common.require_rate(currency, rate),
        due_date=due_date,
        note=note,
    )
    db.add(payable)
    db.flush()
    post_payable(db, payable, actor, clock.today())
    audit.record(
        db,
        actor=actor,
        action="payable.create",
        entity_type="event",
        entity_id=event.id,
        summary=f"{event.event_no} için borç eklendi: {title} {amount} {currency}.",
        context=context,
    )
    db.commit()
    db.refresh(payable)
    return payable


def update_payable(
    db: Session,
    payable: Payable,
    changes: dict,
    *,
    actor: User,
    context: RequestContext,
) -> Payable:
    """Gerçekleşen maliyet farklıysa tutar düzeltilir; fark defterde düzeltme fişiyle işlenir."""
    if payable.status != DocStatus.ACTIVE:
        raise DomainError("İptal edilmiş borç düzenlenemez.")
    ensure_event_open(db, payable.event_id)
    if "artist_id" in changes or "supplier_id" in changes:
        artist_id = changes.get("artist_id", payable.artist_id)
        supplier_id = changes.get("supplier_id", payable.supplier_id)
        _check_payee(db, artist_id, supplier_id)
    paid = paid_amount(db, payable.id)
    new_amount = changes.get("amount", payable.amount)
    new_rate = changes.get("rate", payable.rate)
    if new_amount < paid:
        raise DomainError(f"Borç tutarı ödenmiş tutardan ({paid} {payable.currency}) az olamaz.")
    if new_rate != payable.rate and paid > 0:
        raise DomainError("Ödeme yapılmış borcun kuru değiştirilemez.")
    if payable.currency == "TRY":
        new_rate = Decimal("1")

    old_base = money(payable.amount * payable.rate)
    new_base = money(new_amount * new_rate)
    diff = new_base - old_base
    before = {"amount": str(payable.amount), "rate": str(payable.rate)}
    for key in ("title", "due_date", "note", "artist_id", "supplier_id"):
        if key in changes:
            setattr(payable, key, changes[key])
    payable.amount = money(new_amount)
    payable.rate = new_rate
    if diff != 0:
        cost_account = Account.EVENT_COST if payable.event_id else Account.EXPENSE
        amount_diff = money(new_amount - Decimal(before["amount"]))
        ledger.post(
            db,
            kind=EntryKind.PAYABLE_ADJUSTMENT,
            entry_date=clock.today(),
            description=f"Borç düzeltme: {payable.title}",
            legs=[
                Leg(
                    cost_account,
                    diff,
                    amount_diff,
                    Currency(payable.currency),
                    new_rate,
                    event_id=payable.event_id,
                ),
                Leg(
                    Account.SUPPLIER_PAYABLE,
                    -diff,
                    -amount_diff,
                    Currency(payable.currency),
                    new_rate,
                    payable_id=payable.id,
                    event_id=payable.event_id,
                ),
            ],
            actor=actor,
            event_id=payable.event_id,
        )
    audit.record(
        db,
        actor=actor,
        action="payable.update",
        entity_type="event" if payable.event_id else "payable",
        entity_id=payable.event_id or payable.id,
        summary=f"Borç güncellendi: {payable.title}.",
        changes={
            "before": before,
            "after": {"amount": str(payable.amount), "rate": str(payable.rate)},
        },
        context=context,
    )
    db.commit()
    db.refresh(payable)
    return payable


def cancel_payable(
    db: Session, payable: Payable, reason: str, *, actor: User, context: RequestContext
) -> Payable:
    if payable.status != DocStatus.ACTIVE:
        raise DomainError("Bu borç zaten iptal edilmiş.")
    ensure_event_open(db, payable.event_id)
    if not reason:
        raise DomainError("İptal sebebini yazın.")
    if paid_amount(db, payable.id) > 0:
        raise DomainError("Ödemesi yapılmış borç iptal edilemez; önce ödemeleri iptal edin.")
    if payable.expense_id:
        raise DomainError("Bu borç bir giderden doğdu; gideri iptal edin.")
    reverse_payable(db, payable, reason, actor)
    audit.record(
        db,
        actor=actor,
        action="payable.cancel",
        entity_type="event" if payable.event_id else "payable",
        entity_id=payable.event_id or payable.id,
        summary=f"Borç iptal edildi: {payable.title}. Sebep: {reason}",
        context=context,
    )
    db.commit()
    db.refresh(payable)
    return payable


def pay(
    db: Session,
    payable: Payable,
    *,
    payment_date: date,
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
) -> PayablePayment:
    if payable.status != DocStatus.ACTIVE:
        raise DomainError("İptal edilmiş borca ödeme yapılamaz.")
    if (cash_account_id is None) == (partner_id is None):
        raise DomainError("Ödemenin kaynağını seçin: şirket kasası/bankası veya ortak.")
    if amount <= 0:
        raise DomainError("Ödeme tutarı sıfırdan büyük olmalıdır.")
    common.check_date(payment_date)
    rate = common.require_rate(currency, rate)
    if currency == payable.currency:
        applied = amount
    elif applied_amount is None or applied_amount <= 0:
        raise DomainError(
            f"Ödeme {currency}, borç {payable.currency}. "
            f"Bu ödemenin kapattığı {payable.currency} tutarını girin."
        )
    else:
        applied = applied_amount

    paid = paid_amount(db, payable.id)
    remaining = money(payable.amount - paid)
    if applied > remaining:
        raise DomainError(f"Kalan borç {remaining} {payable.currency}; fazla ödeme yapılamaz.")

    if cash_account_id is not None:
        account = common.get_cash_account(db, cash_account_id, currency)
        common.assert_cash_available(db, account, amount, payment_date)
        source = ledger.leg(
            Account.CASH,
            amount,
            currency,
            rate,
            credit=True,
            cash_account_id=account.id,
            event_id=payable.event_id,
        )
        where = account.name
    else:
        partner = common.get_partner(db, partner_id)  # type: ignore[arg-type]
        source = ledger.leg(
            Account.PARTNER_PAYABLE,
            amount,
            currency,
            rate,
            credit=True,
            partner_id=partner.id,
            event_id=payable.event_id,
        )
        where = f"{partner.full_name} cebinden"

    payable_base = ledger.balance(
        db, Account.SUPPLIER_PAYABLE, payable_id=payable.id
    )  # negatif (alacak)
    debit_base = -payable_base if applied == remaining else money(applied * payable.rate)
    debt = Leg(
        Account.SUPPLIER_PAYABLE,
        debit_base,
        applied,
        Currency(payable.currency),
        payable.rate,
        payable_id=payable.id,
        event_id=payable.event_id,
    )
    legs = [debt, source]
    # Kapanmış etkinliğin kârı değişmez: sonradan oluşan kur farkı dönem sonucuna yazılır.
    fx_event = None if event_closed(db, payable.event_id) else payable.event_id
    fx = ledger.balancing_fx_leg(legs, event_id=fx_event)
    if fx:
        legs.append(fx)
    entry = ledger.post(
        db,
        kind=EntryKind.SUPPLIER_PAYMENT,
        entry_date=payment_date,
        description=f"Ödeme: {payee_name(payable) or payable.title} ({where})",
        legs=legs,
        actor=actor,
        event_id=payable.event_id,
    )
    payment = PayablePayment(
        payment_no=next_number(db, "payment", payment_date.year, "VIA-OD"),
        payable_id=payable.id,
        payment_date=payment_date,
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
    )
    db.add(payment)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="payment.create",
        entity_type="event" if payable.event_id else "payable",
        entity_id=payable.event_id or payable.id,
        summary=f"{payment.payment_no}: {payable.title} için {amount} {currency} ödendi ({where}).",
        context=context,
    )
    db.commit()
    db.refresh(payment)
    return payment


def cancel_payment(
    db: Session, payment: PayablePayment, reason: str, *, actor: User, context: RequestContext
) -> PayablePayment:
    if payment.status != DocStatus.ACTIVE:
        raise DomainError("Bu ödeme zaten iptal edilmiş.")
    ensure_event_open(db, payment.payable.event_id)
    if not reason:
        raise DomainError("İptal sebebini yazın.")
    if payment.partner_id is not None:
        # Ortağa olan borç bu ödemeden doğdu; ortağa geri ödenmişse iptal edilemez.
        owed, _ = common.carrying(
            db, Account.PARTNER_PAYABLE, payment.currency, partner_id=payment.partner_id
        )
        if payment.amount > -owed:
            raise DomainError("Bu tutar ortağa geri ödenmiş görünüyor; önce o ödemeyi iptal edin.")
    entry = db.get(JournalEntry, payment.entry_id)
    ledger.reverse(
        db,
        entry,  # type: ignore[arg-type]
        entry_date=clock.today(),
        description=f"Ödeme iptali: {payment.payment_no}. Sebep: {reason}",
        actor=actor,
    )
    payment.status = DocStatus.CANCELLED
    payment.cancel_reason = reason
    payable = payment.payable
    audit.record(
        db,
        actor=actor,
        action="payment.cancel",
        entity_type="event" if payable.event_id else "payable",
        entity_id=payable.event_id or payable.id,
        summary=f"{payment.payment_no} ödemesi iptal edildi. Sebep: {reason}",
        context=context,
    )
    db.commit()
    db.refresh(payment)
    return payment
