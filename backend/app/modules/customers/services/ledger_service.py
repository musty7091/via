from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.utils.money import D, money
from app.models.partner import Partner
from app.modules.customers import constants
from app.modules.customers.repositories import ledger_repository
from app.modules.customers.schemas.ledger import (
    CustomerLedgerMovementCreate,
    CustomerLedgerMovementRead,
    CustomerLedgerSummary,
)
from app.modules.customers.services.customer_service import get_customer_or_404


def _validate_choice(field_name: str, value: str | None, allowed_values: list[str]) -> None:
    if value is None:
        return

    if value not in allowed_values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} gecersiz. Gecerli degerler: {', '.join(allowed_values)}",
        )


def _calculate_base_amount(amount: float, exchange_rate: float, base_amount: float | None) -> float:
    if base_amount is not None:
        return money(D(base_amount))

    return money(D(amount) * D(exchange_rate))


def _validate_partner_exists(db: Session, partner_id: int | None) -> None:
    if partner_id is None:
        return

    partner = db.get(Partner, partner_id)

    if partner is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tahsilati yapan ortak bulunamadi.",
        )


def _build_ledger_read_items(db: Session, movements) -> list[CustomerLedgerMovementRead]:
    event_ids = {item.event_id for item in movements if item.event_id is not None}
    partner_ids = {
        item.collected_by_partner_id
        for item in movements
        if item.collected_by_partner_id is not None
    }

    event_titles = ledger_repository.get_event_titles(db=db, event_ids=event_ids)
    partner_names = ledger_repository.get_partner_names(db=db, partner_ids=partner_ids)

    running_balance = D(0)
    response_items: list[CustomerLedgerMovementRead] = []

    for item in movements:
        base_amount = D(item.base_amount)
        debit_amount = base_amount if item.direction == "debit" else D(0)
        credit_amount = base_amount if item.direction == "credit" else D(0)

        if not item.is_cancelled:
            running_balance = money(running_balance + debit_amount - credit_amount)

        response_items.append(
            CustomerLedgerMovementRead(
                id=item.id,
                customer_id=item.customer_id,
                event_id=item.event_id,
                event_title=event_titles.get(item.event_id) if item.event_id else None,
                collection_id=item.collection_id,
                payment_plan_id=item.payment_plan_id,
                movement_date=item.movement_date,
                movement_type=item.movement_type,
                direction=item.direction,
                title=item.title,
                description=item.description,
                detail_note=item.detail_note,
                amount=D(item.amount),
                currency=item.currency,
                exchange_rate=D(item.exchange_rate),
                base_amount=base_amount,
                debit_base_amount=debit_amount,
                credit_base_amount=credit_amount,
                running_balance_base_amount=running_balance,
                payment_method=item.payment_method,
                collected_by_partner_id=item.collected_by_partner_id,
                collected_by_partner_name=(
                    partner_names.get(item.collected_by_partner_id)
                    if item.collected_by_partner_id
                    else None
                ),
                created_by_user_id=item.created_by_user_id,
                document_no=item.document_no,
                reference_type=item.reference_type,
                reference_id=item.reference_id,
                is_cancelled=item.is_cancelled,
                cancellation_reason=item.cancellation_reason,
                notes=item.notes,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
        )

    return response_items


def list_ledger(
    db: Session,
    customer_id: int,
    include_cancelled: bool = False,
) -> list[CustomerLedgerMovementRead]:
    get_customer_or_404(db=db, customer_id=customer_id)

    movements = ledger_repository.list_movements(
        db=db,
        customer_id=customer_id,
        include_cancelled=include_cancelled,
    )

    return _build_ledger_read_items(db=db, movements=movements)


def create_movement(
    db: Session,
    customer_id: int,
    payload: CustomerLedgerMovementCreate,
    created_by_user_id: int | None = None,
) -> CustomerLedgerMovementRead:
    get_customer_or_404(db=db, customer_id=customer_id)

    _validate_choice("movement_type", payload.movement_type, constants.LEDGER_MOVEMENT_TYPES)
    _validate_choice("direction", payload.direction, constants.LEDGER_DIRECTIONS)
    _validate_choice("currency", payload.currency, constants.CURRENCIES)
    _validate_choice("payment_method", payload.payment_method, constants.PAYMENT_METHODS)
    _validate_partner_exists(db=db, partner_id=payload.collected_by_partner_id)

    data = payload.model_dump()
    data["customer_id"] = customer_id
    data["created_by_user_id"] = created_by_user_id
    data["base_amount"] = _calculate_base_amount(
        amount=payload.amount,
        exchange_rate=payload.exchange_rate,
        base_amount=payload.base_amount,
    )

    created = ledger_repository.create_movement(db=db, data=data)
    items = list_ledger(db=db, customer_id=customer_id, include_cancelled=False)

    for item in items:
        if item.id == created.id:
            return item

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Musteri hesap hareketi olusturuldu fakat okunamadi.",
    )


def get_ledger_summary(db: Session, customer_id: int) -> CustomerLedgerSummary:
    get_customer_or_404(db=db, customer_id=customer_id)

    movements = ledger_repository.list_movements(
        db=db,
        customer_id=customer_id,
        include_cancelled=False,
    )

    total_debit = D(0)
    total_credit = D(0)
    last_movement_date: date | None = None

    for item in movements:
        base_amount = D(item.base_amount)

        if item.direction == "debit":
            total_debit += base_amount
        elif item.direction == "credit":
            total_credit += base_amount

        if last_movement_date is None or item.movement_date > last_movement_date:
            last_movement_date = item.movement_date

    total_debit = money(total_debit)
    total_credit = money(total_credit)
    balance = money(total_debit - total_credit)

    return CustomerLedgerSummary(
        customer_id=customer_id,
        total_debit_base_amount=total_debit,
        total_credit_base_amount=total_credit,
        balance_base_amount=balance,
        movement_count=len(movements),
        last_movement_date=last_movement_date,
    )