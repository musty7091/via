from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.finance import FinancialMovement
from app.models.partner import Partner
from app.modules.partner_accounts.schemas import (
    PartnerAccountBalanceItem,
    PartnerAccountBalancesResponse,
    PartnerAccountBalancesSummary,
    PartnerAccountStatementLine,
    PartnerAccountStatementResponse,
    PartnerAccountStatementSummary,
)

RECEIVABLE_INCREASE = "company_receivable_from_partner_increase"
RECEIVABLE_DECREASE = "company_receivable_from_partner_decrease"
PAYABLE_INCREASE = "company_payable_to_partner_increase"
PAYABLE_DECREASE = "company_payable_to_partner_decrease"

PARTNER_EFFECTS = {
    RECEIVABLE_INCREASE,
    RECEIVABLE_DECREASE,
    PAYABLE_INCREASE,
    PAYABLE_DECREASE,
}


def _to_float(value) -> float:
    if value is None:
        return 0.0

    return float(value)


def _balance_direction(value: float) -> str:
    if value > 0.0001:
        return "partner_owes_company"

    if value < -0.0001:
        return "company_owes_partner"

    return "balanced"


def _get_partner_or_404(db: Session, partner_id: int) -> Partner:
    partner = db.get(Partner, partner_id)

    if partner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ortak bulunamadı.",
        )

    return partner


def _get_event_title(db: Session, event_id: int | None) -> str | None:
    if event_id is None:
        return None

    event = db.get(Event, event_id)

    if event is None:
        return None

    return event.title


def _movement_to_amounts(movement: FinancialMovement) -> dict:
    base_amount = _to_float(movement.base_amount)

    company_receivable_debit = 0.0
    company_receivable_credit = 0.0
    company_payable_debit = 0.0
    company_payable_credit = 0.0

    if movement.partner_effect == RECEIVABLE_INCREASE:
        company_receivable_debit = base_amount
    elif movement.partner_effect == RECEIVABLE_DECREASE:
        company_receivable_credit = base_amount
    elif movement.partner_effect == PAYABLE_INCREASE:
        company_payable_credit = base_amount
    elif movement.partner_effect == PAYABLE_DECREASE:
        company_payable_debit = base_amount

    return {
        "company_receivable_debit": round(company_receivable_debit, 4),
        "company_receivable_credit": round(company_receivable_credit, 4),
        "company_payable_debit": round(company_payable_debit, 4),
        "company_payable_credit": round(company_payable_credit, 4),
    }


def _partner_movement_query(
    db: Session,
    *,
    partner_id: int | None = None,
    event_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    query = (
        db.query(FinancialMovement)
        .filter(FinancialMovement.partner_id.isnot(None))
        .filter(FinancialMovement.partner_effect.in_(PARTNER_EFFECTS))
        .filter(FinancialMovement.is_cancelled == False)  # noqa: E712
    )

    if partner_id is not None:
        query = query.filter(FinancialMovement.partner_id == partner_id)

    if event_id is not None:
        query = query.filter(FinancialMovement.event_id == event_id)

    if date_from is not None:
        query = query.filter(FinancialMovement.movement_date >= date_from)

    if date_to is not None:
        query = query.filter(FinancialMovement.movement_date <= date_to)

    return query


def _get_partner_movements(
    db: Session,
    *,
    partner_id: int,
    event_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[FinancialMovement]:
    return (
        _partner_movement_query(
            db=db,
            partner_id=partner_id,
            event_id=event_id,
            date_from=date_from,
            date_to=date_to,
        )
        .order_by(FinancialMovement.movement_date.asc(), FinancialMovement.id.asc())
        .all()
    )


def get_partner_account_statement(
    db: Session,
    *,
    partner_id: int,
    event_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> PartnerAccountStatementResponse:
    partner = _get_partner_or_404(db=db, partner_id=partner_id)

    movements = _get_partner_movements(
        db=db,
        partner_id=partner_id,
        event_id=event_id,
        date_from=date_from,
        date_to=date_to,
    )

    receivable_debit_total = 0.0
    receivable_credit_total = 0.0
    payable_credit_total = 0.0
    payable_debit_total = 0.0
    net_balance = 0.0

    items: list[PartnerAccountStatementLine] = []

    for index, movement in enumerate(movements, start=1):
        amounts = _movement_to_amounts(movement=movement)

        receivable_debit_total += amounts["company_receivable_debit"]
        receivable_credit_total += amounts["company_receivable_credit"]
        payable_debit_total += amounts["company_payable_debit"]
        payable_credit_total += amounts["company_payable_credit"]

        net_balance = round(
            receivable_debit_total
            - receivable_credit_total
            - payable_credit_total
            + payable_debit_total,
            4,
        )

        items.append(
            PartnerAccountStatementLine(
                line_no=index,
                line_date=movement.movement_date,
                partner_id=partner.id,
                partner_name=partner.full_name,
                event_id=movement.event_id,
                event_title=_get_event_title(db=db, event_id=movement.event_id),
                source_type=movement.source_type,
                source_id=movement.source_id,
                movement_type=movement.movement_type,
                account_area=movement.account_area,
                partner_effect=movement.partner_effect,
                title=movement.title,
                description=movement.description,
                company_receivable_debit_base_amount=amounts["company_receivable_debit"],
                company_receivable_credit_base_amount=amounts["company_receivable_credit"],
                company_payable_debit_base_amount=amounts["company_payable_debit"],
                company_payable_credit_base_amount=amounts["company_payable_credit"],
                net_balance_base_amount=net_balance,
                balance_direction=_balance_direction(net_balance),
                source_amount=round(_to_float(movement.amount), 4),
                source_currency=movement.currency,
                exchange_rate=round(_to_float(movement.exchange_rate), 6),
                document_no=movement.document_no,
                status=movement.status,
                notes=movement.notes,
            )
        )

    company_receivable_balance = round(receivable_debit_total - receivable_credit_total, 4)
    company_payable_balance = round(payable_credit_total - payable_debit_total, 4)
    net_balance = round(company_receivable_balance - company_payable_balance, 4)

    summary = PartnerAccountStatementSummary(
        partner_id=partner.id,
        partner_name=partner.full_name,
        total_company_receivable_debit_base_amount=round(receivable_debit_total, 4),
        total_company_receivable_credit_base_amount=round(receivable_credit_total, 4),
        company_receivable_balance_base_amount=company_receivable_balance,
        total_company_payable_credit_base_amount=round(payable_credit_total, 4),
        total_company_payable_debit_base_amount=round(payable_debit_total, 4),
        company_payable_balance_base_amount=company_payable_balance,
        net_balance_base_amount=net_balance,
        balance_direction=_balance_direction(net_balance),
        line_count=len(items),
    )

    return PartnerAccountStatementResponse(
        summary=summary,
        items=items,
    )


def _get_partner_candidates(
    db: Session,
    *,
    include_inactive: bool,
) -> list[Partner]:
    query = db.query(Partner)

    if not include_inactive:
        query = query.filter(Partner.is_active == True)  # noqa: E712

    return query.order_by(Partner.full_name.asc()).all()


def get_partner_account_balances(
    db: Session,
    *,
    event_id: int | None = None,
    only_with_balance: bool = False,
    include_inactive: bool = False,
) -> PartnerAccountBalancesResponse:
    partners = _get_partner_candidates(
        db=db,
        include_inactive=include_inactive,
    )

    items: list[PartnerAccountBalanceItem] = []

    for partner in partners:
        movements = (
            _partner_movement_query(
                db=db,
                partner_id=partner.id,
                event_id=event_id,
            )
            .order_by(FinancialMovement.movement_date.asc(), FinancialMovement.id.asc())
            .all()
        )

        receivable_debit_total = 0.0
        receivable_credit_total = 0.0
        payable_debit_total = 0.0
        payable_credit_total = 0.0
        transaction_dates: list[date] = []

        for movement in movements:
            amounts = _movement_to_amounts(movement=movement)
            receivable_debit_total += amounts["company_receivable_debit"]
            receivable_credit_total += amounts["company_receivable_credit"]
            payable_debit_total += amounts["company_payable_debit"]
            payable_credit_total += amounts["company_payable_credit"]
            transaction_dates.append(movement.movement_date)

        company_receivable_balance = round(receivable_debit_total - receivable_credit_total, 4)
        company_payable_balance = round(payable_credit_total - payable_debit_total, 4)
        net_balance = round(company_receivable_balance - company_payable_balance, 4)

        if only_with_balance and abs(net_balance) <= 0.0001:
            continue

        event_ids = {movement.event_id for movement in movements if movement.event_id is not None}

        items.append(
            PartnerAccountBalanceItem(
                partner_id=partner.id,
                partner_name=partner.full_name,
                is_active=bool(partner.is_active),
                company_receivable_balance_base_amount=company_receivable_balance,
                company_payable_balance_base_amount=company_payable_balance,
                net_balance_base_amount=net_balance,
                balance_direction=_balance_direction(net_balance),
                movement_count=len(movements),
                event_count=len(event_ids),
                last_transaction_date=max(transaction_dates) if transaction_dates else None,
            )
        )

    items.sort(
        key=lambda item: (
            0 if abs(item.net_balance_base_amount) > 0.0001 else 1,
            item.partner_name.lower(),
        )
    )

    total_receivable = round(sum(item.company_receivable_balance_base_amount for item in items), 4)
    total_payable = round(sum(item.company_payable_balance_base_amount for item in items), 4)
    total_net = round(sum(item.net_balance_base_amount for item in items), 4)

    summary = PartnerAccountBalancesSummary(
        total_partner_count=len(items),
        total_company_receivable_balance_base_amount=total_receivable,
        total_company_payable_balance_base_amount=total_payable,
        total_net_balance_base_amount=total_net,
        partner_owes_company_count=sum(1 for item in items if item.net_balance_base_amount > 0.0001),
        company_owes_partner_count=sum(1 for item in items if item.net_balance_base_amount < -0.0001),
        balanced_partner_count=sum(1 for item in items if abs(item.net_balance_base_amount) <= 0.0001),
    )

    return PartnerAccountBalancesResponse(
        summary=summary,
        items=items,
    )
