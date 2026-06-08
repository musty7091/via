from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.event import Event
from app.models.expense import Expense, ExpenseAllocation
from app.models.finance import CarryForwardItem, EventFinancialClosure, EventSupplierPayable, FinancialMovement
from app.models.payment import Collection, PaymentPlan
from app.models.partner import Partner
from app.models.period import MonthlyPeriod
from app.models.user import User
from app.modules.finance_engine.service import create_financial_movement
from app.modules.period_closing.schemas import (
    CarryForwardItemRead,
    PeriodCloseRequest,
    PeriodCloseResponse,
    PeriodClosingEventPartnerShare,
    PeriodClosingEventSummary,
    PeriodClosingIssue,
    PeriodClosingPartnerSummary,
    PeriodClosingPreviewItem,
    PeriodClosingPreviewResponse,
    PeriodClosingPreviewSummary,
)


def _to_float(value) -> float:
    if value is None:
        return 0.0

    return float(value)


def _round_money(value) -> float:
    return round(_to_float(value), 4)


def _parse_period_month(period_month: str) -> tuple[date, date]:
    try:
        year_text, month_text = period_month.split("-")
        year = int(year_text)
        month = int(month_text)

        if month < 1 or month > 12:
            raise ValueError

        start_date = date(year, month, 1)

        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)

        return start_date, end_date
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dönem formatı geçersiz. YYYY-MM formatı kullanılmalıdır. Örnek: 2026-06",
        )


def _next_period_month(period_month: str) -> str:
    _start_date, end_date = _parse_period_month(period_month)
    return end_date.strftime("%Y-%m")


def _get_or_create_period(db: Session, *, period_month: str) -> MonthlyPeriod:
    period = (
        db.query(MonthlyPeriod)
        .filter(MonthlyPeriod.period_month == period_month)
        .first()
    )

    if period is not None:
        return period

    period = MonthlyPeriod(
        period_month=period_month,
        status="open",
        is_locked=False,
    )

    db.add(period)
    db.flush()

    return period


def _get_events_for_period(db: Session, *, period_month: str) -> list[Event]:
    start_date, end_date = _parse_period_month(period_month)

    return (
        db.query(Event)
        .filter(
            Event.event_date >= start_date,
            Event.event_date < end_date,
        )
        .order_by(Event.event_date.asc(), Event.id.asc())
        .all()
    )


def _latest_event_closure(db: Session, *, event_id: int) -> EventFinancialClosure | None:
    return (
        db.query(EventFinancialClosure)
        .filter(EventFinancialClosure.event_id == event_id)
        .order_by(EventFinancialClosure.closure_version.desc(), EventFinancialClosure.id.desc())
        .first()
    )


def _is_event_financially_approved(db: Session, *, event_id: int) -> bool:
    closure = _latest_event_closure(db=db, event_id=event_id)
    return closure is not None and closure.status == "approved"


def _sum_payment_plans(db: Session, *, event_id: int) -> float:
    value = (
        db.query(func.coalesce(func.sum(PaymentPlan.base_amount), 0))
        .filter(PaymentPlan.event_id == event_id)
        .scalar()
    )

    return _round_money(value)


def _sum_collections(db: Session, *, event_id: int) -> float:
    value = (
        db.query(func.coalesce(func.sum(Collection.base_amount), 0))
        .filter(
            Collection.event_id == event_id,
            Collection.is_cancelled == False,  # noqa: E712
        )
        .scalar()
    )

    return _round_money(value)


def _sum_event_expenses(db: Session, *, event_id: int) -> float:
    value = (
        db.query(func.coalesce(func.sum(Expense.base_amount), 0))
        .filter(
            Expense.event_id == event_id,
            Expense.is_cancelled == False,  # noqa: E712
        )
        .scalar()
    )

    return _round_money(value)


def _sum_general_expenses_for_period(db: Session, *, period_month: str) -> float:
    start_date, end_date = _parse_period_month(period_month)

    value = (
        db.query(func.coalesce(func.sum(Expense.base_amount), 0))
        .filter(
            Expense.event_id.is_(None),
            Expense.is_allocated == False,  # noqa: E712
            Expense.is_cancelled == False,  # noqa: E712
            Expense.expense_date >= start_date,
            Expense.expense_date < end_date,
        )
        .scalar()
    )

    return _round_money(value)


def _sum_allocated_expenses_for_period(db: Session, *, period_month: str) -> float:
    value = (
        db.query(func.coalesce(func.sum(ExpenseAllocation.allocated_base_amount), 0))
        .join(Expense, Expense.id == ExpenseAllocation.expense_id)
        .filter(
            ExpenseAllocation.period_month == period_month,
            Expense.is_cancelled == False,  # noqa: E712
        )
        .scalar()
    )

    return _round_money(value)


def _supplier_payables(db: Session, *, event_id: int) -> list[EventSupplierPayable]:
    return (
        db.query(EventSupplierPayable)
        .filter(EventSupplierPayable.event_id == event_id)
        .order_by(EventSupplierPayable.id.asc())
        .all()
    )


def _supplier_payable_total(db: Session, *, event_id: int) -> float:
    return _round_money(sum(_to_float(item.base_amount) for item in _supplier_payables(db=db, event_id=event_id)))



def _supplier_payable_remaining_total(db: Session, *, event_id: int) -> float:
    return _round_money(
        sum(_to_float(item.remaining_base_amount) for item in _supplier_payables(db=db, event_id=event_id))
    )


def _get_customer_name(db: Session, *, customer_id: int | None) -> str | None:
    if customer_id is None:
        return None

    customer = db.get(Customer, customer_id)

    if customer is None:
        return None

    return customer.name


def _get_event_closure_status(db: Session, *, event_id: int) -> str:
    closure = _latest_event_closure(db=db, event_id=event_id)

    if closure is None:
        return "not_prepared"

    return closure.status


def _build_event_partner_profit_shares(
    db: Session,
    *,
    operational_profit: float,
) -> list[PeriodClosingEventPartnerShare]:
    shares: list[PeriodClosingEventPartnerShare] = []

    for partner in _get_active_partners(db=db):
        ownership_percent = _round_money(partner.ownership_percent)
        profit_share = _round_money(operational_profit * ownership_percent / 100)

        shares.append(
            PeriodClosingEventPartnerShare(
                partner_id=partner.id,
                partner_name=partner.full_name,
                ownership_percent=ownership_percent,
                profit_share_base_amount=profit_share,
            )
        )

    return shares


def _financial_movements(db: Session, *, event_id: int) -> list[FinancialMovement]:
    return (
        db.query(FinancialMovement)
        .filter(
            FinancialMovement.event_id == event_id,
            FinancialMovement.is_cancelled == False,  # noqa: E712
        )
        .order_by(FinancialMovement.movement_date.asc(), FinancialMovement.id.asc())
        .all()
    )


def _partner_balances_from_movements(db: Session, *, event_id: int) -> dict[int, dict[str, float]]:
    balances: dict[int, dict[str, float]] = {}

    for movement in _financial_movements(db=db, event_id=event_id):
        if movement.partner_id is None:
            continue

        partner_id = movement.partner_id

        if partner_id not in balances:
            balances[partner_id] = {
                "partner_cash_on_hand": 0.0,
                "company_payable_to_partner": 0.0,
            }

        amount = _to_float(movement.base_amount)

        if movement.cash_effect == "increase_partner_cash_on_hand":
            balances[partner_id]["partner_cash_on_hand"] += amount
        elif movement.cash_effect == "decrease_partner_cash_on_hand":
            balances[partner_id]["partner_cash_on_hand"] -= amount

        if movement.partner_effect == "company_payable_to_partner_increase":
            balances[partner_id]["company_payable_to_partner"] += amount
        elif movement.partner_effect == "company_payable_to_partner_decrease":
            balances[partner_id]["company_payable_to_partner"] -= amount

    return balances



def _get_active_partners(db: Session) -> list[Partner]:
    return (
        db.query(Partner)
        .filter(Partner.is_active == True)  # noqa: E712
        .order_by(Partner.full_name.asc())
        .all()
    )


def _partner_balance_direction(value: float) -> str:
    if value > 0.0001:
        return "company_owes_partner"

    if value < -0.0001:
        return "partner_owes_company"

    return "balanced"


def _build_partner_summaries(
    db: Session,
    *,
    net_profit: float,
    partner_cash_by_partner: dict[int, float],
    company_payable_to_partner_by_partner: dict[int, float],
) -> list[PeriodClosingPartnerSummary]:
    summaries: list[PeriodClosingPartnerSummary] = []

    for partner in _get_active_partners(db=db):
        ownership_percent = _round_money(partner.ownership_percent)
        profit_share = _round_money(net_profit * ownership_percent / 100)
        partner_cash_on_hand = _round_money(partner_cash_by_partner.get(partner.id, 0))
        company_payable_to_partner = _round_money(company_payable_to_partner_by_partner.get(partner.id, 0))
        net_company_payable = _round_money(
            profit_share + company_payable_to_partner - partner_cash_on_hand
        )

        summaries.append(
            PeriodClosingPartnerSummary(
                partner_id=partner.id,
                partner_name=partner.full_name,
                ownership_percent=ownership_percent,
                profit_share_base_amount=profit_share,
                partner_cash_on_hand_base_amount=partner_cash_on_hand,
                company_payable_to_partner_base_amount=company_payable_to_partner,
                net_company_payable_to_partner_base_amount=net_company_payable,
                balance_direction=_partner_balance_direction(net_company_payable),
            )
        )

    return summaries


def _make_item(
    *,
    carry_type: str,
    base_amount: float,
    carry_reason: str,
    event: Event | None = None,
    customer_id: int | None = None,
    partner_id: int | None = None,
    artist_id: int | None = None,
    service_item_id: int | None = None,
    source_reference_type: str | None = None,
    source_reference_id: int | None = None,
) -> PeriodClosingPreviewItem:
    return PeriodClosingPreviewItem(
        carry_type=carry_type,
        event_id=event.id if event is not None else None,
        event_title=event.title if event is not None else None,
        customer_id=customer_id,
        partner_id=partner_id,
        artist_id=artist_id,
        service_item_id=service_item_id,
        source_reference_type=source_reference_type,
        source_reference_id=source_reference_id,
        amount=_round_money(base_amount),
        currency="TRY",
        exchange_rate=1,
        base_amount=_round_money(base_amount),
        remaining_base_amount=_round_money(base_amount),
        carry_reason=carry_reason,
    )


def build_period_closing_preview(
    db: Session,
    *,
    period_month: str,
) -> PeriodClosingPreviewResponse:
    _parse_period_month(period_month)
    target_period_month = _next_period_month(period_month)

    source_period = (
        db.query(MonthlyPeriod)
        .filter(MonthlyPeriod.period_month == period_month)
        .first()
    )

    events = _get_events_for_period(db=db, period_month=period_month)

    carry_items: list[PeriodClosingPreviewItem] = []
    issues: list[PeriodClosingIssue] = []
    event_summaries: list[PeriodClosingEventSummary] = []

    total_revenue = 0.0
    total_event_cost = 0.0
    total_event_expense = 0.0
    total_general_expense = _sum_general_expenses_for_period(db=db, period_month=period_month)
    total_allocated_expense = _sum_allocated_expenses_for_period(db=db, period_month=period_month)

    customer_receivable_total = 0.0
    supplier_payable_total = 0.0
    partner_cash_total = 0.0
    company_payable_to_partner_total = 0.0
    partner_cash_by_partner: dict[int, float] = {}
    company_payable_to_partner_by_partner: dict[int, float] = {}
    open_event_count = 0

    if source_period is not None and source_period.is_locked:
        issues.append(
            PeriodClosingIssue(
                key="period_already_locked",
                severity="error",
                blocking=True,
                message="Bu dönem daha önce kapanmış ve kilitlenmiş.",
            )
        )

    if not events:
        issues.append(
            PeriodClosingIssue(
                key="no_events",
                severity="warning",
                blocking=False,
                message="Bu dönemde etkinlik bulunamadı. Dönem yine de kapatılabilir.",
            )
        )

    for event in events:
        agreement_base_amount = _round_money(event.base_agreement_amount or event.total_customer_amount or 0)
        planned_base_amount = _sum_payment_plans(db=db, event_id=event.id)
        collected_base_amount = _sum_collections(db=db, event_id=event.id)

        expected_collection = max(agreement_base_amount, planned_base_amount)
        customer_remaining = _round_money(max(expected_collection - collected_base_amount, 0))

        event_supplier_total = _supplier_payable_total(db=db, event_id=event.id)
        event_supplier_remaining_total = _supplier_payable_remaining_total(db=db, event_id=event.id)
        event_expense_total = _sum_event_expenses(db=db, event_id=event.id)
        event_operational_profit = _round_money(agreement_base_amount - event_supplier_total - event_expense_total)

        total_revenue += agreement_base_amount
        total_event_cost += event_supplier_total
        total_event_expense += event_expense_total

        event_carry_labels: list[str] = []

        if not _is_event_financially_approved(db=db, event_id=event.id):
            event_carry_labels.append("Açık etkinlik")
            open_event_count += 1
            carry_items.append(
                _make_item(
                    carry_type="open_event",
                    base_amount=0,
                    event=event,
                    customer_id=event.customer_id,
                    source_reference_type="event",
                    source_reference_id=event.id,
                    carry_reason="Etkinlik finansal kapanışı onaylanmadığı için sonraki döneme açık etkinlik olarak devreder.",
                )
            )

        if customer_remaining > 0.0001:
            event_carry_labels.append("Müşteri alacağı")
            customer_receivable_total += customer_remaining
            carry_items.append(
                _make_item(
                    carry_type="customer_receivable",
                    base_amount=customer_remaining,
                    event=event,
                    customer_id=event.customer_id,
                    source_reference_type="event",
                    source_reference_id=event.id,
                    carry_reason="Dönem kapanışında müşteri tahsilatı tamamlanmadığı için alacak sonraki döneme devreder.",
                )
            )

        for payable in _supplier_payables(db=db, event_id=event.id):
            remaining = _round_money(payable.remaining_base_amount)

            if remaining <= 0.0001:
                continue

            event_carry_labels.append("Sanatçı / hizmet borcu")
            supplier_payable_total += remaining
            carry_items.append(
                _make_item(
                    carry_type="supplier_payable",
                    base_amount=remaining,
                    event=event,
                    artist_id=payable.artist_id,
                    service_item_id=payable.service_item_id,
                    source_reference_type="event_supplier_payable",
                    source_reference_id=payable.id,
                    carry_reason="Dönem kapanışında sanatçı/hizmet borcu açık olduğu için sonraki döneme devreder.",
                )
            )

        partner_balances = _partner_balances_from_movements(db=db, event_id=event.id)

        for partner_id, balances in partner_balances.items():
            partner_cash = _round_money(balances["partner_cash_on_hand"])
            company_payable_to_partner = _round_money(balances["company_payable_to_partner"])

            partner_cash_by_partner[partner_id] = _round_money(
                partner_cash_by_partner.get(partner_id, 0) + partner_cash
            )
            company_payable_to_partner_by_partner[partner_id] = _round_money(
                company_payable_to_partner_by_partner.get(partner_id, 0) + company_payable_to_partner
            )

            if partner_cash > 0.0001:
                if "Ortak üzerindeki para" not in event_carry_labels:
                    event_carry_labels.append("Ortak üzerindeki para")
                partner_cash_total += partner_cash
                carry_items.append(
                    _make_item(
                        carry_type="partner_cash_on_hand",
                        base_amount=partner_cash,
                        event=event,
                        partner_id=partner_id,
                        source_reference_type="financial_movement",
                        source_reference_id=None,
                        carry_reason="Dönem kapanışında ortağın üzerinde şirkete teslim edilmemiş tahsilat bulunduğu için sonraki döneme devreder.",
                    )
                )

            if company_payable_to_partner > 0.0001:
                if "Şirketin ortağa borcu" not in event_carry_labels:
                    event_carry_labels.append("Şirketin ortağa borcu")
                company_payable_to_partner_total += company_payable_to_partner
                carry_items.append(
                    _make_item(
                        carry_type="company_payable_to_partner",
                        base_amount=company_payable_to_partner,
                        event=event,
                        partner_id=partner_id,
                        source_reference_type="financial_movement",
                        source_reference_id=None,
                        carry_reason="Dönem kapanışında şirketin ortağa borcu bulunduğu için sonraki döneme devreder.",
                    )
                )

        event_summaries.append(
            PeriodClosingEventSummary(
                event_id=event.id,
                event_code=event.event_code,
                event_title=event.title,
                event_date=event.event_date.isoformat(),
                customer_id=event.customer_id,
                customer_name=_get_customer_name(db=db, customer_id=event.customer_id),
                event_status=event.status,
                financial_closure_status=_get_event_closure_status(db=db, event_id=event.id),
                is_financially_approved=_is_event_financially_approved(db=db, event_id=event.id),
                event_notes=event.notes,
                agreement_base_amount=agreement_base_amount,
                planned_base_amount=planned_base_amount,
                collected_base_amount=collected_base_amount,
                remaining_customer_receivable_base_amount=customer_remaining,
                supplier_payable_base_amount=event_supplier_total,
                remaining_supplier_payable_base_amount=event_supplier_remaining_total,
                event_expense_base_amount=event_expense_total,
                operational_profit_base_amount=event_operational_profit,
                carry_forward_labels=event_carry_labels,
                partner_profit_shares=_build_event_partner_profit_shares(
                    db=db,
                    operational_profit=event_operational_profit,
                ),
            )
        )

    net_profit = _round_money(total_revenue - total_event_cost - total_event_expense - total_general_expense - total_allocated_expense)

    partner_summaries = _build_partner_summaries(
        db=db,
        net_profit=net_profit,
        partner_cash_by_partner=partner_cash_by_partner,
        company_payable_to_partner_by_partner=company_payable_to_partner_by_partner,
    )

    for partner_summary in partner_summaries:
        profit_share = _round_money(partner_summary.profit_share_base_amount)

        if profit_share > 0.0001:
            company_payable_to_partner_total += profit_share
            carry_items.append(
                _make_item(
                    carry_type="company_payable_to_partner",
                    base_amount=profit_share,
                    partner_id=partner_summary.partner_id,
                    source_reference_type="period_profit_share",
                    source_reference_id=partner_summary.partner_id,
                    carry_reason=(
                        f"{period_month} dönemi kâr payı: "
                        f"{partner_summary.partner_name} için %{partner_summary.ownership_percent} ortaklık payı."
                    ),
                )
            )

    blocking_issue_count = sum(1 for item in issues if item.blocking)
    warning_count = sum(1 for item in issues if item.severity == "warning")

    summary = PeriodClosingPreviewSummary(
        period_month=period_month,
        target_period_month=target_period_month,
        source_period_status=source_period.status if source_period is not None else None,
        source_period_is_locked=bool(source_period.is_locked) if source_period is not None else False,
        event_count=len(events),
        open_event_count=open_event_count,
        total_revenue_base_amount=_round_money(total_revenue),
        total_event_cost_base_amount=_round_money(total_event_cost),
        total_event_expense_base_amount=_round_money(total_event_expense),
        total_general_expense_base_amount=_round_money(total_general_expense),
        total_allocated_expense_base_amount=_round_money(total_allocated_expense),
        net_profit_base_amount=net_profit,
        customer_receivable_base_amount=_round_money(customer_receivable_total),
        supplier_payable_base_amount=_round_money(supplier_payable_total),
        partner_cash_on_hand_base_amount=_round_money(partner_cash_total),
        company_payable_to_partner_base_amount=_round_money(company_payable_to_partner_total),
        carry_forward_count=len(carry_items),
        blocking_issue_count=blocking_issue_count,
        warning_count=warning_count,
        can_close_period=blocking_issue_count == 0,
    )

    return PeriodClosingPreviewResponse(
        summary=summary,
        issues=issues,
        carry_forward_items=carry_items,
        partner_summaries=partner_summaries,
        event_summaries=event_summaries,
    )


def close_period(
    db: Session,
    *,
    period_month: str,
    payload: PeriodCloseRequest,
    current_user: User,
) -> PeriodCloseResponse:
    preview = build_period_closing_preview(db=db, period_month=period_month)

    if not preview.summary.can_close_period:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Dönem kapatılamaz.",
                "issues": [item.model_dump() for item in preview.issues if item.blocking],
            },
        )

    target_period_month = preview.summary.target_period_month
    source_period = _get_or_create_period(db=db, period_month=period_month)
    target_period = _get_or_create_period(db=db, period_month=target_period_month)

    if source_period.is_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu dönem zaten kapalı ve kilitli.",
        )

    created_count = 0
    now = datetime.now(timezone.utc)
    closing_movement_date = _parse_period_month(period_month)[1] - timedelta(days=1)

    for partner_summary in preview.partner_summaries:
        profit_share = _round_money(partner_summary.profit_share_base_amount)

        if profit_share <= 0.0001:
            continue

        create_financial_movement(
            db=db,
            movement_date=closing_movement_date,
            source_type="monthly_period",
            source_id=source_period.id,
            movement_type="period_partner_profit_share",
            account_area="partner_account",
            direction="out",
            amount=profit_share,
            currency="TRY",
            exchange_rate=1,
            base_amount=profit_share,
            title="Dönem kâr payı ortağa tahakkuk etti",
            partner_id=partner_summary.partner_id,
            monthly_period_id=source_period.id,
            movement_group_key=f"period_profit_share:{source_period.id}:{partner_summary.partner_id}",
            customer_effect="none",
            cash_effect="none",
            partner_effect="company_payable_to_partner_increase",
            profit_effect="none",
            description=(
                f"{period_month} dönemi net kârından {partner_summary.partner_name} "
                f"için hesaplanan ortak kâr payı."
            ),
            notes=payload.closing_note,
            created_by_user_id=current_user.id,
            approved_by_user_id=current_user.id,
        )

    for item in preview.carry_forward_items:
        carry_item = CarryForwardItem(
            carry_type=item.carry_type,
            status="open",
            source_period_id=source_period.id,
            target_period_id=target_period.id,
            source_period_month=period_month,
            target_period_month=target_period_month,
            event_id=item.event_id,
            customer_id=item.customer_id,
            partner_id=item.partner_id,
            artist_id=item.artist_id,
            service_item_id=item.service_item_id,
            cash_account_id=None,
            source_reference_type=item.source_reference_type,
            source_reference_id=item.source_reference_id,
            due_date=None,
            amount=item.amount,
            currency=item.currency,
            exchange_rate=item.exchange_rate,
            base_amount=item.base_amount,
            remaining_base_amount=item.remaining_base_amount,
            carry_reason=item.carry_reason,
            approval_note=payload.closing_note,
            approved_by_user_id=current_user.id,
            approved_at=now,
            notes=None,
        )
        db.add(carry_item)
        created_count += 1

    events = _get_events_for_period(db=db, period_month=period_month)

    for event in events:
        event.is_period_closed = True

    source_period.status = "closed"
    source_period.is_locked = True
    source_period.closed_by_user_id = current_user.id
    source_period.closed_at = now
    source_period.notes = payload.closing_note

    source_period.total_revenue_base_amount = preview.summary.total_revenue_base_amount
    source_period.total_event_cost_base_amount = preview.summary.total_event_cost_base_amount
    source_period.total_event_expense_base_amount = preview.summary.total_event_expense_base_amount
    source_period.total_general_expense_base_amount = preview.summary.total_general_expense_base_amount
    source_period.total_allocated_expense_base_amount = preview.summary.total_allocated_expense_base_amount
    source_period.net_profit_base_amount = preview.summary.net_profit_base_amount

    db.commit()
    db.refresh(source_period)
    db.refresh(target_period)

    return PeriodCloseResponse(
        period_month=period_month,
        target_period_month=target_period_month,
        monthly_period_id=source_period.id,
        target_monthly_period_id=target_period.id,
        status=source_period.status,
        is_locked=bool(source_period.is_locked),
        closed_at=source_period.closed_at,
        created_carry_forward_count=created_count,
        event_count=preview.summary.event_count,
        open_event_count=preview.summary.open_event_count,
        total_revenue_base_amount=preview.summary.total_revenue_base_amount,
        total_event_cost_base_amount=preview.summary.total_event_cost_base_amount,
        total_event_expense_base_amount=preview.summary.total_event_expense_base_amount,
        total_general_expense_base_amount=preview.summary.total_general_expense_base_amount,
        total_allocated_expense_base_amount=preview.summary.total_allocated_expense_base_amount,
        net_profit_base_amount=preview.summary.net_profit_base_amount,
        message="Dönem kapatıldı. Açık kalemler sonraki döneme devredildi.",
    )


def list_carry_forward_items(
    db: Session,
    *,
    period_month: str,
) -> list[CarryForwardItemRead]:
    items = (
        db.query(CarryForwardItem)
        .filter(CarryForwardItem.source_period_month == period_month)
        .order_by(CarryForwardItem.id.asc())
        .all()
    )

    return [CarryForwardItemRead.model_validate(item) for item in items]
