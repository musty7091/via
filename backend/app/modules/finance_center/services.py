from sqlalchemy.orm import Session

from app.models.finance import FinancialMovement
from app.models.payment import CashAccount
from app.utils.money import D, money


def _to_float(value) -> float:
    if value is None:
        return D(0)

    return D(value)


def _base_query(
    db: Session,
    *,
    event_id: int | None = None,
    customer_id: int | None = None,
    partner_id: int | None = None,
    period_month: str | None = None,
    source_type: str | None = None,
    movement_type: str | None = None,
    account_area: str | None = None,
    status: str | None = None,
    include_cancelled: bool = False,
):
    query = db.query(FinancialMovement)

    if not include_cancelled:
        query = query.filter(FinancialMovement.is_cancelled == False)  # noqa: E712

    if event_id is not None:
        query = query.filter(FinancialMovement.event_id == event_id)

    if customer_id is not None:
        query = query.filter(FinancialMovement.customer_id == customer_id)

    if partner_id is not None:
        query = query.filter(FinancialMovement.partner_id == partner_id)

    if period_month:
        query = query.filter(FinancialMovement.period_month == period_month)

    if source_type:
        query = query.filter(FinancialMovement.source_type == source_type)

    if movement_type:
        query = query.filter(FinancialMovement.movement_type == movement_type)

    if account_area:
        query = query.filter(FinancialMovement.account_area == account_area)

    if status:
        query = query.filter(FinancialMovement.status == status)

    return query


def list_financial_movements(
    db: Session,
    *,
    event_id: int | None = None,
    customer_id: int | None = None,
    partner_id: int | None = None,
    period_month: str | None = None,
    source_type: str | None = None,
    movement_type: str | None = None,
    account_area: str | None = None,
    status: str | None = None,
    include_cancelled: bool = False,
    skip: int = 0,
    limit: int = 100,
):
    query = _base_query(
        db=db,
        event_id=event_id,
        customer_id=customer_id,
        partner_id=partner_id,
        period_month=period_month,
        source_type=source_type,
        movement_type=movement_type,
        account_area=account_area,
        status=status,
        include_cancelled=include_cancelled,
    )

    total_count = query.count()

    items = (
        query
        .order_by(
            FinancialMovement.movement_date.desc(),
            FinancialMovement.id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    return total_count, items


def get_financial_movements_summary(
    db: Session,
    *,
    event_id: int | None = None,
    customer_id: int | None = None,
    partner_id: int | None = None,
    period_month: str | None = None,
    source_type: str | None = None,
    movement_type: str | None = None,
    account_area: str | None = None,
    status: str | None = None,
    include_cancelled: bool = False,
):
    items = (
        _base_query(
            db=db,
            event_id=event_id,
            customer_id=customer_id,
            partner_id=partner_id,
            period_month=period_month,
            source_type=source_type,
            movement_type=movement_type,
            account_area=account_area,
            status=status,
            include_cancelled=include_cancelled,
        )
        .all()
    )

    total_in_base_amount = D(0)
    total_out_base_amount = D(0)
    company_cash_in_base_amount = D(0)
    company_cash_out_base_amount = D(0)
    partner_cash_in_base_amount = D(0)
    partner_cash_out_base_amount = D(0)

    for item in items:
        base_amount = _to_float(item.base_amount)

        if item.direction == "in":
            total_in_base_amount += base_amount
        elif item.direction == "out":
            total_out_base_amount += base_amount

        if item.account_area == "company_cash":
            if item.direction == "in":
                company_cash_in_base_amount += base_amount
            elif item.direction == "out":
                company_cash_out_base_amount += base_amount

        if item.account_area == "partner_cash_on_hand":
            if item.direction == "in":
                partner_cash_in_base_amount += base_amount
            elif item.direction == "out":
                partner_cash_out_base_amount += base_amount

    return {
        "total_count": len(items),
        "total_in_base_amount": money(total_in_base_amount),
        "total_out_base_amount": money(total_out_base_amount),
        "net_base_amount": money(total_in_base_amount - total_out_base_amount),
        "company_cash_in_base_amount": money(company_cash_in_base_amount),
        "company_cash_out_base_amount": money(company_cash_out_base_amount),
        "partner_cash_in_base_amount": money(partner_cash_in_base_amount),
        "partner_cash_out_base_amount": money(partner_cash_out_base_amount),
    }

def list_cash_accounts(
    db: Session,
    *,
    is_active: bool | None = True,
):
    query = db.query(CashAccount)

    if is_active is not None:
        query = query.filter(CashAccount.is_active == is_active)

    return (
        query
        .order_by(
            CashAccount.account_type.asc(),
            CashAccount.name.asc(),
            CashAccount.id.asc(),
        )
        .all()
    )


def get_total_customer_receivable(db: Session) -> dict:
    """Tüm müşterilerin güncel (canlı) toplam alacak bakiyesi.

    Müşteri cari hareketlerinde borç (debit) alacağı artırır, tahsilat (credit)
    azaltır. Toplam alacak = borç toplamı - tahsilat toplamı (iptaller hariç).
    """
    from sqlalchemy import func

    from app.models.customer_account_movement import CustomerAccountMovement

    rows = (
        db.query(
            CustomerAccountMovement.direction,
            func.coalesce(func.sum(CustomerAccountMovement.base_amount), 0),
        )
        .filter(CustomerAccountMovement.is_cancelled == False)  # noqa: E712
        .group_by(CustomerAccountMovement.direction)
        .all()
    )

    debit = D(0)
    credit = D(0)
    for direction, total in rows:
        if direction == "debit":
            debit += D(total)
        elif direction == "credit":
            credit += D(total)

    receivable = money(debit - credit)

    return {
        "total_receivable_base_amount": receivable,
        "total_debit_base_amount": money(debit),
        "total_credit_base_amount": money(credit),
    }
