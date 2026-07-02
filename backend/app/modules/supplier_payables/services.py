
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.artist import Artist, ServiceItem
from app.models.event import Event
from app.models.finance import EventSupplierPayable, EventSupplierPayment
from app.models.partner import Partner
from app.models.payment import CashAccount
from app.models.user import User
from app.modules.finance_engine.service import (
    assert_event_period_open,
    assert_period_open,
    record_supplier_payable_created,
    record_supplier_payment_cancelled,
    record_supplier_payment_created,
)
from app.modules.supplier_payables.schemas import (
    EventSupplierPayablesDetail,
    SupplierPayableCreate,
    SupplierPayableRead,
    SupplierPayablesSummary,
    SupplierPaymentCancel,
    SupplierPaymentCreate,
    SupplierPaymentRead,
)
from app.utils.money import D, money


def _to_float(value) -> float:
    if value is None:
        return D(0)

    return D(value)


def _clean_currency(currency: str | None, default: str = "TRY") -> str:
    if not currency:
        return default

    return currency.strip().upper()


def _calculate_base_amount(amount: float, exchange_rate: float) -> float:
    return money(D(amount) * D(exchange_rate))


def _get_event_or_404(db: Session, event_id: int) -> Event:
    event = db.get(Event, event_id)

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etkinlik dosyası bulunamadı.",
        )

    return event


def _get_artist_or_404(db: Session, artist_id: int | None) -> Artist | None:
    if artist_id is None:
        return None

    artist = db.get(Artist, artist_id)

    if artist is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sanatçı bulunamadı.",
        )

    if not artist.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pasif sanatçı için borç kaydı oluşturulamaz.",
        )

    return artist


def _get_service_item_or_404(db: Session, service_item_id: int | None) -> ServiceItem | None:
    if service_item_id is None:
        return None

    service_item = db.get(ServiceItem, service_item_id)

    if service_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hizmet kalemi bulunamadı.",
        )

    if not service_item.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pasif hizmet için borç kaydı oluşturulamaz.",
        )

    return service_item


def _get_partner_or_404(db: Session, partner_id: int | None) -> Partner | None:
    if partner_id is None:
        return None

    partner = db.get(Partner, partner_id)

    if partner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödemeyi yapan ortak bulunamadı.",
        )

    if not partner.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pasif ortak üzerinden ödeme yapılamaz.",
        )

    return partner


def _get_cash_account_or_404(db: Session, cash_account_id: int | None) -> CashAccount | None:
    if cash_account_id is None:
        return None

    cash_account = db.get(CashAccount, cash_account_id)

    if cash_account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kasa/banka hesabı bulunamadı.",
        )

    if not cash_account.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pasif kasa/banka hesabından ödeme yapılamaz.",
        )

    return cash_account


def _get_payable_or_404(db: Session, event_id: int, payable_id: int) -> EventSupplierPayable:
    payable = db.get(EventSupplierPayable, payable_id)

    if payable is None or payable.event_id != event_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sanatçı/hizmet borç kaydı bulunamadı.",
        )

    return payable


def _get_payment_or_404(
    db: Session,
    event_id: int,
    payable_id: int,
    payment_id: int,
) -> EventSupplierPayment:
    payment = db.get(EventSupplierPayment, payment_id)

    if payment is None or payment.event_id != event_id or payment.payable_id != payable_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sanatçı/hizmet ödeme kaydı bulunamadı.",
        )

    return payment


def _update_payable_status(db: Session, payable: EventSupplierPayable) -> None:
    paid_base_amount = (
        db.query(func.coalesce(func.sum(EventSupplierPayment.base_amount), 0))
        .filter(
            EventSupplierPayment.payable_id == payable.id,
            EventSupplierPayment.is_cancelled == False,  # noqa: E712
        )
        .scalar()
    )

    paid = money(_to_float(paid_base_amount))
    total = money(_to_float(payable.base_amount))
    remaining = money(total - paid)

    payable.paid_base_amount = paid
    payable.remaining_base_amount = max(remaining, 0)

    if paid <= 0:
        payable.status = "open"
    elif paid + D("0.0001") >= total:
        payable.status = "paid"
        payable.remaining_base_amount = 0
    else:
        payable.status = "partial"


def _list_payables(db: Session, event_id: int) -> list[EventSupplierPayable]:
    return (
        db.query(EventSupplierPayable)
        .filter(EventSupplierPayable.event_id == event_id)
        .order_by(EventSupplierPayable.id.asc())
        .all()
    )


def _list_payments(db: Session, event_id: int) -> list[EventSupplierPayment]:
    return (
        db.query(EventSupplierPayment)
        .filter(EventSupplierPayment.event_id == event_id)
        .order_by(EventSupplierPayment.payment_date.desc(), EventSupplierPayment.id.desc())
        .all()
    )


def get_event_supplier_payables_detail(
    db: Session,
    event_id: int,
) -> EventSupplierPayablesDetail:
    _get_event_or_404(db=db, event_id=event_id)

    payables = _list_payables(db=db, event_id=event_id)
    payments = _list_payments(db=db, event_id=event_id)

    total_payable_base_amount = sum(_to_float(item.base_amount) for item in payables)
    total_paid_base_amount = sum(
        _to_float(item.base_amount)
        for item in payments
        if not item.is_cancelled
    )
    total_remaining_base_amount = sum(_to_float(item.remaining_base_amount) for item in payables)

    summary = SupplierPayablesSummary(
        event_id=event_id,
        total_payable_base_amount=money(total_payable_base_amount),
        total_paid_base_amount=money(total_paid_base_amount),
        total_remaining_base_amount=money(total_remaining_base_amount),
        open_payable_count=sum(1 for item in payables if item.status == "open"),
        partial_payable_count=sum(1 for item in payables if item.status == "partial"),
        paid_payable_count=sum(1 for item in payables if item.status == "paid"),
    )

    return EventSupplierPayablesDetail(
        summary=summary,
        payables=[SupplierPayableRead.model_validate(item) for item in payables],
        payments=[SupplierPaymentRead.model_validate(item) for item in payments],
    )


def create_supplier_payable(
    db: Session,
    event_id: int,
    payload: SupplierPayableCreate,
    current_user: User,
) -> EventSupplierPayable:
    event = _get_event_or_404(db=db, event_id=event_id)
    assert_event_period_open(event)
    _get_artist_or_404(db=db, artist_id=payload.artist_id)
    _get_service_item_or_404(db=db, service_item_id=payload.service_item_id)

    currency = _clean_currency(payload.currency)
    exchange_rate = D(payload.exchange_rate or 1)
    base_amount = _calculate_base_amount(payload.amount, exchange_rate)

    payable = EventSupplierPayable(
        event_id=event_id,
        artist_id=payload.artist_id,
        service_item_id=payload.service_item_id,
        payable_type=payload.payable_type.strip(),
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        due_date=payload.due_date,
        amount=D(payload.amount),
        currency=currency,
        exchange_rate=exchange_rate,
        base_amount=base_amount,
        paid_base_amount=0,
        remaining_base_amount=base_amount,
        status="open",
        is_carried_forward=False,
        carry_forward_item_id=None,
        created_by_user_id=current_user.id,
        approved_by_user_id=current_user.id,
        notes=payload.notes.strip() if payload.notes else None,
    )

    db.add(payable)
    db.flush()

    record_supplier_payable_created(
        db=db,
        payable=payable,
        current_user_id=current_user.id,
    )

    db.commit()
    db.refresh(payable)

    return payable


def create_supplier_payment(
    db: Session,
    event_id: int,
    payable_id: int,
    payload: SupplierPaymentCreate,
    current_user: User,
) -> EventSupplierPayment:
    payable = _get_payable_or_404(db=db, event_id=event_id, payable_id=payable_id)
    assert_event_period_open(_get_event_or_404(db=db, event_id=event_id))

    if payable.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu borç zaten tamamen ödenmiş.",
        )

    _get_partner_or_404(db=db, partner_id=payload.paid_by_partner_id)
    _get_cash_account_or_404(db=db, cash_account_id=payload.cash_account_id)

    currency = _clean_currency(payload.currency, payable.currency)
    exchange_rate = D(payload.exchange_rate or payable.exchange_rate or 1)
    base_amount = _calculate_base_amount(payload.amount, exchange_rate)

    if base_amount > _to_float(payable.remaining_base_amount) + D("0.0001"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ödeme tutarı kalan borçtan fazla olamaz.",
        )

    payment = EventSupplierPayment(
        payable_id=payable.id,
        event_id=event_id,
        paid_by_partner_id=payload.paid_by_partner_id,
        paid_by_user_id=current_user.id,
        cash_account_id=payload.cash_account_id,
        payment_date=payload.payment_date,
        amount=D(payload.amount),
        currency=currency,
        exchange_rate=exchange_rate,
        base_amount=base_amount,
        payment_method=payload.payment_method.strip(),
        document_no=payload.document_no.strip() if payload.document_no else None,
        notes=payload.notes.strip() if payload.notes else None,
        is_cancelled=False,
        cancellation_reason=None,
    )

    db.add(payment)
    db.flush()

    _update_payable_status(db=db, payable=payable)

    record_supplier_payment_created(
        db=db,
        payable=payable,
        payment=payment,
        current_user_id=current_user.id,
    )

    db.commit()
    db.refresh(payment)

    return payment


def cancel_supplier_payment(
    db: Session,
    event_id: int,
    payable_id: int,
    payment_id: int,
    payload: SupplierPaymentCancel,
    current_user: User,
) -> EventSupplierPayment:
    payable = _get_payable_or_404(db=db, event_id=event_id, payable_id=payable_id)
    payment = _get_payment_or_404(
        db=db,
        event_id=event_id,
        payable_id=payable_id,
        payment_id=payment_id,
    )

    if payment.is_cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu ödeme zaten iptal edilmiş.",
        )

    assert_period_open(db, payment.payment_date)
    assert_event_period_open(_get_event_or_404(db=db, event_id=event_id))

    payment.is_cancelled = True
    payment.cancellation_reason = payload.cancellation_reason.strip()

    db.flush()

    _update_payable_status(db=db, payable=payable)

    record_supplier_payment_cancelled(
        db=db,
        payable=payable,
        payment=payment,
        current_user_id=current_user.id,
    )

    db.commit()
    db.refresh(payment)

    return payment
