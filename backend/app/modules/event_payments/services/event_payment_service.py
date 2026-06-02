from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.partner import Partner
from app.models.payment import Collection, PaymentPlan
from app.models.user import User
from app.modules.event_payments.schemas import (
    CollectionCancel,
    CollectionCreate,
    CollectionRead,
    EventPaymentSummary,
    EventPaymentsDetail,
    PaymentPlanCreate,
    PaymentPlanRead,
    PaymentPlanUpdate,
)


def _to_float(value) -> float:
    if value is None:
        return 0.0

    return float(value)


def _clean_currency(currency: str | None, default: str = "TRY") -> str:
    if not currency:
        return default

    return currency.strip().upper()


def _calculate_base_amount(amount: float, exchange_rate: float) -> float:
    return round(float(amount) * float(exchange_rate), 4)


def _get_event_or_404(db: Session, event_id: int) -> Event:
    event = db.get(Event, event_id)

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etkinlik dosyası bulunamadı.",
        )

    return event


def _get_plan_or_404(db: Session, event_id: int, payment_plan_id: int) -> PaymentPlan:
    plan = db.get(PaymentPlan, payment_plan_id)

    if plan is None or plan.event_id != event_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme planı bulunamadı.",
        )

    return plan


def _get_collection_or_404(db: Session, event_id: int, collection_id: int) -> Collection:
    collection = db.get(Collection, collection_id)

    if collection is None or collection.event_id != event_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahsilat kaydı bulunamadı.",
        )

    return collection


def _validate_partner(db: Session, partner_id: int | None) -> None:
    if partner_id is None:
        return

    partner = db.get(Partner, partner_id)

    if partner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tahsilatı yapan ortak bulunamadı.",
        )

    if not partner.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pasif ortak tahsilat yapan kişi olarak seçilemez.",
        )


def _update_plan_paid_status(db: Session, plan: PaymentPlan) -> None:
    paid_base_amount = (
        db.query(func.coalesce(func.sum(Collection.base_amount), 0))
        .filter(
            Collection.payment_plan_id == plan.id,
            Collection.is_cancelled == False,  # noqa: E712
        )
        .scalar()
    )

    paid = _to_float(paid_base_amount)
    total = _to_float(plan.base_amount)

    plan.paid_base_amount = paid

    if paid <= 0:
        plan.status = "pending"
    elif paid + 0.0001 >= total:
        plan.status = "paid"
    else:
        plan.status = "partial"


def _list_payment_plans(db: Session, event_id: int) -> list[PaymentPlan]:
    return (
        db.query(PaymentPlan)
        .filter(PaymentPlan.event_id == event_id)
        .order_by(PaymentPlan.due_date.asc(), PaymentPlan.id.asc())
        .all()
    )


def _list_collections(db: Session, event_id: int) -> list[Collection]:
    return (
        db.query(Collection)
        .filter(Collection.event_id == event_id)
        .order_by(Collection.collection_date.desc(), Collection.id.desc())
        .all()
    )


def _build_detail(db: Session, event: Event) -> EventPaymentsDetail:
    plans = _list_payment_plans(db=db, event_id=event.id)
    collections = _list_collections(db=db, event_id=event.id)

    planned_base_amount = sum(_to_float(plan.base_amount) for plan in plans)
    collected_base_amount = sum(
        _to_float(collection.base_amount)
        for collection in collections
        if not collection.is_cancelled
    )

    event_total_amount = _to_float(event.total_customer_amount)
    event_base_total_amount = _to_float(event.total_customer_amount) * _to_float(event.exchange_rate or 1)

    summary = EventPaymentSummary(
        event_id=event.id,
        event_total_amount=event_total_amount,
        event_currency=event.agreement_currency,
        event_base_total_amount=round(event_base_total_amount, 4),
        planned_base_amount=round(planned_base_amount, 4),
        collected_base_amount=round(collected_base_amount, 4),
        remaining_base_amount=round(event_base_total_amount - collected_base_amount, 4),
        unplanned_base_amount=round(event_base_total_amount - planned_base_amount, 4),
    )

    return EventPaymentsDetail(
        summary=summary,
        payment_plans=[PaymentPlanRead.model_validate(plan) for plan in plans],
        collections=[CollectionRead.model_validate(collection) for collection in collections],
    )


def get_event_payments_detail(db: Session, event_id: int) -> EventPaymentsDetail:
    event = _get_event_or_404(db=db, event_id=event_id)
    return _build_detail(db=db, event=event)


def create_payment_plan(
    db: Session,
    event_id: int,
    payload: PaymentPlanCreate,
) -> PaymentPlan:
    event = _get_event_or_404(db=db, event_id=event_id)

    currency = _clean_currency(payload.currency, event.agreement_currency)
    exchange_rate = float(payload.exchange_rate or event.exchange_rate or 1)

    plan = PaymentPlan(
        event_id=event.id,
        title=payload.title.strip(),
        due_date=payload.due_date,
        amount=float(payload.amount),
        currency=currency,
        exchange_rate=exchange_rate,
        base_amount=_calculate_base_amount(payload.amount, exchange_rate),
        paid_base_amount=0,
        status="pending",
        notes=payload.notes.strip() if payload.notes else None,
    )

    db.add(plan)
    db.commit()
    db.refresh(plan)

    return plan


def update_payment_plan(
    db: Session,
    event_id: int,
    payment_plan_id: int,
    payload: PaymentPlanUpdate,
) -> PaymentPlan:
    plan = _get_plan_or_404(db=db, event_id=event_id, payment_plan_id=payment_plan_id)
    data = payload.model_dump(exclude_unset=True)

    if "title" in data and data["title"] is not None:
        plan.title = data["title"].strip()

    if "due_date" in data and data["due_date"] is not None:
        plan.due_date = data["due_date"]

    if "amount" in data and data["amount"] is not None:
        plan.amount = float(data["amount"])

    if "currency" in data and data["currency"] is not None:
        plan.currency = _clean_currency(data["currency"], plan.currency)

    if "exchange_rate" in data and data["exchange_rate"] is not None:
        plan.exchange_rate = float(data["exchange_rate"])

    if "notes" in data:
        plan.notes = data["notes"].strip() if data["notes"] else None

    plan.base_amount = _calculate_base_amount(plan.amount, plan.exchange_rate)
    _update_plan_paid_status(db=db, plan=plan)

    db.commit()
    db.refresh(plan)

    return plan


def create_collection(
    db: Session,
    event_id: int,
    payload: CollectionCreate,
    current_user: User,
) -> Collection:
    event = _get_event_or_404(db=db, event_id=event_id)

    plan: PaymentPlan | None = None
    if payload.payment_plan_id is not None:
        plan = _get_plan_or_404(
            db=db,
            event_id=event_id,
            payment_plan_id=payload.payment_plan_id,
        )

    _validate_partner(db=db, partner_id=payload.received_by_partner_id)

    currency = _clean_currency(payload.currency, event.agreement_currency)
    exchange_rate = float(payload.exchange_rate or event.exchange_rate or 1)
    base_amount = _calculate_base_amount(payload.amount, exchange_rate)

    collection = Collection(
        event_id=event.id,
        payment_plan_id=plan.id if plan else None,
        customer_id=event.customer_id,
        received_by_user_id=current_user.id,
        received_by_partner_id=payload.received_by_partner_id,
        collection_date=payload.collection_date,
        amount=float(payload.amount),
        currency=currency,
        exchange_rate=exchange_rate,
        base_amount=base_amount,
        payment_method=payload.payment_method.strip(),
        current_location="with_partner" if payload.received_by_partner_id else "company",
        is_transferred_to_company=False,
        document_no=payload.document_no.strip() if payload.document_no else None,
        notes=payload.notes.strip() if payload.notes else None,
        is_cancelled=False,
        cancellation_reason=None,
    )

    db.add(collection)
    db.flush()

    if plan is not None:
        _update_plan_paid_status(db=db, plan=plan)

    db.commit()
    db.refresh(collection)

    return collection


def cancel_collection(
    db: Session,
    event_id: int,
    collection_id: int,
    payload: CollectionCancel,
) -> Collection:
    collection = _get_collection_or_404(
        db=db,
        event_id=event_id,
        collection_id=collection_id,
    )

    if collection.is_cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tahsilat kaydı zaten iptal edilmiş.",
        )

    collection.is_cancelled = True
    collection.cancellation_reason = payload.cancellation_reason.strip()

    db.flush()

    if collection.payment_plan_id is not None:
        plan = _get_plan_or_404(
            db=db,
            event_id=event_id,
            payment_plan_id=collection.payment_plan_id,
        )
        _update_plan_paid_status(db=db, plan=plan)

    db.commit()
    db.refresh(collection)

    return collection
