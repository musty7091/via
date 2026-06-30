from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.utils.money import D, money
from app.models.event import Event
from app.models.expense import Expense
from app.models.finance import (
    EventFinancialClosure,
    EventSupplierPayable,
    EventSupplierPayment,
    FinancialMovement,
)
from app.models.payment import Collection, PaymentPlan
from app.models.user import User
from app.modules.event_financial_closure.schemas import (
    EventFinancialClosureChecklistResponse,
    EventFinancialClosureRead,
    EventFinancialClosurePrepareRequest,
    EventFinancialClosureApproveRequest,
    EventFinancialClosureReopenRequest,
    FinancialClosureChecklistItem,
)


def _to_float(value) -> float:
    if value is None:
        return D(0)

    return D(value)


def _round_money(value) -> float:
    return money(value)


def _get_event_or_404(db: Session, event_id: int) -> Event:
    event = db.get(Event, event_id)

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etkinlik bulunamadı.",
        )

    return event


def _event_period_month(event: Event) -> str | None:
    if event.event_date is None:
        return None

    return event.event_date.strftime("%Y-%m")


def _latest_closure(db: Session, event_id: int) -> EventFinancialClosure | None:
    return (
        db.query(EventFinancialClosure)
        .filter(EventFinancialClosure.event_id == event_id)
        .order_by(EventFinancialClosure.closure_version.desc(), EventFinancialClosure.id.desc())
        .first()
    )


def _next_closure_version(db: Session, event_id: int) -> int:
    max_version = (
        db.query(func.coalesce(func.max(EventFinancialClosure.closure_version), 0))
        .filter(EventFinancialClosure.event_id == event_id)
        .scalar()
    )

    return int(max_version or 0) + 1


def _sum_payment_plans(db: Session, event_id: int) -> float:
    value = (
        db.query(func.coalesce(func.sum(PaymentPlan.base_amount), 0))
        .filter(PaymentPlan.event_id == event_id)
        .scalar()
    )

    return _round_money(value)


def _sum_collections(db: Session, event_id: int) -> float:
    value = (
        db.query(func.coalesce(func.sum(Collection.base_amount), 0))
        .filter(
            Collection.event_id == event_id,
            Collection.is_cancelled == False,  # noqa: E712
        )
        .scalar()
    )

    return _round_money(value)


def _sum_carried_customer_collections(db: Session, event_id: int) -> float:
    """Devreden müşteri alacağı sonradan tahsil edildiyse etkinlik kapanışına dahil et.

    Normal tahsilatlar Collection tablosundadır. Ancak dönem kapandıktan sonra
    tahsil edilen eski müşteri alacakları, Devreden Kalem Kapat akışıyla
    financial_movements tablosuna carry_forward_customer_collection olarak yazılır.
    Eski açık etkinliğin final kapanışa hazır hale gelebilmesi için bu tahsilatlar
    da müşteri tahsilatı toplamına eklenmelidir.
    """
    value = (
        db.query(func.coalesce(func.sum(FinancialMovement.base_amount), 0))
        .filter(
            FinancialMovement.event_id == event_id,
            FinancialMovement.movement_type == "carry_forward_customer_collection",
            FinancialMovement.is_cancelled == False,  # noqa: E712
        )
        .scalar()
    )

    return _round_money(value)


def _sum_supplier_payables(db: Session, event_id: int) -> float:
    value = (
        db.query(func.coalesce(func.sum(EventSupplierPayable.base_amount), 0))
        .filter(EventSupplierPayable.event_id == event_id)
        .scalar()
    )

    return _round_money(value)


def _sum_supplier_remaining(db: Session, event_id: int) -> float:
    value = (
        db.query(func.coalesce(func.sum(EventSupplierPayable.remaining_base_amount), 0))
        .filter(EventSupplierPayable.event_id == event_id)
        .scalar()
    )

    return _round_money(value)


def _sum_expenses(db: Session, event_id: int) -> float:
    value = (
        db.query(func.coalesce(func.sum(Expense.base_amount), 0))
        .filter(
            Expense.event_id == event_id,
            Expense.is_cancelled == False,  # noqa: E712
        )
        .scalar()
    )

    return _round_money(value)


def _movement_sum(
    db: Session,
    *,
    event_id: int,
    effect_field: str,
    increase_value: str,
    decrease_value: str,
) -> float:
    movements = (
        db.query(FinancialMovement)
        .filter(
            FinancialMovement.event_id == event_id,
            FinancialMovement.is_cancelled == False,  # noqa: E712
        )
        .all()
    )

    total = D(0)

    for movement in movements:
        field_value = getattr(movement, effect_field)

        if field_value == increase_value:
            total += _to_float(movement.base_amount)
        elif field_value == decrease_value:
            total -= _to_float(movement.base_amount)

    return _round_money(total)


def _partner_cash_on_hand(db: Session, event_id: int) -> float:
    return _movement_sum(
        db=db,
        event_id=event_id,
        effect_field="cash_effect",
        increase_value="increase_partner_cash_on_hand",
        decrease_value="decrease_partner_cash_on_hand",
    )


def _company_receivable_from_partner(db: Session, event_id: int) -> float:
    return _movement_sum(
        db=db,
        event_id=event_id,
        effect_field="partner_effect",
        increase_value="company_receivable_from_partner_increase",
        decrease_value="company_receivable_from_partner_decrease",
    )


def _company_payable_to_partner(db: Session, event_id: int) -> float:
    return _movement_sum(
        db=db,
        event_id=event_id,
        effect_field="partner_effect",
        increase_value="company_payable_to_partner_increase",
        decrease_value="company_payable_to_partner_decrease",
    )


def _supplier_payable_count(db: Session, event_id: int) -> int:
    return (
        db.query(EventSupplierPayable)
        .filter(EventSupplierPayable.event_id == event_id)
        .count()
    )


def _expense_count(db: Session, event_id: int) -> int:
    return (
        db.query(Expense)
        .filter(
            Expense.event_id == event_id,
            Expense.is_cancelled == False,  # noqa: E712
        )
        .count()
    )


def _payment_plan_count(db: Session, event_id: int) -> int:
    return (
        db.query(PaymentPlan)
        .filter(PaymentPlan.event_id == event_id)
        .count()
    )


def _check_item(
    *,
    key: str,
    title: str,
    is_ok: bool,
    blocking: bool,
    ok_message: str,
    fail_message: str,
    warning_when_ok: bool = False,
) -> FinancialClosureChecklistItem:
    if is_ok:
        severity = "warning" if warning_when_ok else "ok"
        message = ok_message
    else:
        severity = "error" if blocking else "warning"
        message = fail_message

    return FinancialClosureChecklistItem(
        key=key,
        title=title,
        is_ok=is_ok,
        blocking=blocking,
        severity=severity,
        message=message,
    )


def calculate_event_financial_closure_snapshot(
    db: Session,
    *,
    event_id: int,
) -> EventFinancialClosureChecklistResponse:
    event = _get_event_or_404(db=db, event_id=event_id)

    agreement_base_amount = _round_money(event.base_agreement_amount or event.total_customer_amount or 0)
    planned_base_amount = _sum_payment_plans(db=db, event_id=event_id)
    period_collected_base_amount = _sum_collections(db=db, event_id=event_id)
    carried_customer_collection_base_amount = _sum_carried_customer_collections(db=db, event_id=event_id)
    collected_base_amount = _round_money(
        period_collected_base_amount + carried_customer_collection_base_amount
    )

    expected_collection_base_amount = max(agreement_base_amount, planned_base_amount)
    remaining_customer_receivable_base_amount = _round_money(
        max(expected_collection_base_amount - collected_base_amount, 0)
    )

    total_event_cost_base_amount = _sum_supplier_payables(db=db, event_id=event_id)
    total_expense_base_amount = _sum_expenses(db=db, event_id=event_id)
    remaining_supplier_payable_base_amount = _sum_supplier_remaining(db=db, event_id=event_id)

    partner_cash_on_hand_base_amount = _partner_cash_on_hand(db=db, event_id=event_id)
    company_receivable_from_partner_base_amount = _company_receivable_from_partner(db=db, event_id=event_id)
    company_payable_to_partner_base_amount = _company_payable_to_partner(db=db, event_id=event_id)

    operational_profit_base_amount = _round_money(
        agreement_base_amount - total_event_cost_base_amount - total_expense_base_amount
    )

    is_agreement_confirmed = agreement_base_amount > 0
    is_payment_plan_matched = (
        _payment_plan_count(db=db, event_id=event_id) > 0
        and planned_base_amount + D("0.0001") >= agreement_base_amount
    )
    is_collection_completed = (
        is_agreement_confirmed
        and collected_base_amount + D("0.0001") >= expected_collection_base_amount
    )
    are_costs_completed = True
    are_expenses_completed = True
    are_supplier_debts_closed_or_carried = remaining_supplier_payable_base_amount <= 0.0001
    are_partner_cash_items_closed_or_carried = (
        partner_cash_on_hand_base_amount <= 0.0001
        and company_receivable_from_partner_base_amount <= 0.0001
    )
    is_profit_calculated = True
    is_partner_share_calculated = False

    distributable_profit_base_amount = D(0)

    if (
        is_collection_completed
        and are_supplier_debts_closed_or_carried
        and are_partner_cash_items_closed_or_carried
    ):
        distributable_profit_base_amount = operational_profit_base_amount

    partner_share_base_amount = D(0)

    supplier_count = _supplier_payable_count(db=db, event_id=event_id)
    expense_count = _expense_count(db=db, event_id=event_id)

    checklist: list[FinancialClosureChecklistItem] = [
        _check_item(
            key="agreement_confirmed",
            title="Anlaşma tutarı",
            is_ok=is_agreement_confirmed,
            blocking=True,
            ok_message="Etkinlik anlaşma tutarı mevcut.",
            fail_message="Etkinlik anlaşma tutarı boş veya sıfır.",
        ),
        _check_item(
            key="payment_plan_matched",
            title="Ödeme planı",
            is_ok=is_payment_plan_matched,
            blocking=True,
            ok_message="Ödeme planı anlaşma tutarını karşılıyor.",
            fail_message="Ödeme planı yok veya anlaşma tutarını karşılamıyor.",
        ),
        _check_item(
            key="collection_completed",
            title="Müşteri tahsilatı",
            is_ok=is_collection_completed,
            blocking=True,
            ok_message="Müşteri tahsilatı ve varsa devreden alacak tahsilatı tamamlanmış görünüyor.",
            fail_message="Müşteri tahsilatı/devreden alacak tahsilatı tamamlanmamış.",
        ),
        _check_item(
            key="supplier_debts_closed",
            title="Sanatçı/hizmet borçları",
            is_ok=are_supplier_debts_closed_or_carried,
            blocking=True,
            ok_message="Açık sanatçı/hizmet borcu görünmüyor.",
            fail_message="Açık sanatçı/hizmet borcu var.",
        ),
        _check_item(
            key="partner_cash_closed",
            title="Ortak üzerindeki tahsilatlar",
            is_ok=are_partner_cash_items_closed_or_carried,
            blocking=True,
            ok_message="Ortak üzerinde şirkete teslim edilmemiş para görünmüyor.",
            fail_message="Ortak üzerinde şirkete teslim edilmemiş para/alacak var.",
        ),
        _check_item(
            key="costs_exist_warning",
            title="Maliyet kaydı kontrolü",
            is_ok=supplier_count > 0,
            blocking=False,
            ok_message="Etkinliğe bağlı sanatçı/hizmet maliyeti var.",
            fail_message="Etkinliğe bağlı sanatçı/hizmet maliyeti görünmüyor. Gerçekten maliyet yoksa sorun değildir.",
        ),
        _check_item(
            key="expenses_exist_warning",
            title="Operasyon gider kontrolü",
            is_ok=expense_count > 0,
            blocking=False,
            ok_message="Etkinliğe bağlı operasyon gideri var.",
            fail_message="Etkinliğe bağlı operasyon gideri görünmüyor. Gerçekten gider yoksa sorun değildir.",
        ),
        _check_item(
            key="partner_payable_warning",
            title="Şirketin ortağa borcu",
            is_ok=company_payable_to_partner_base_amount <= 0.0001,
            blocking=False,
            ok_message="Şirketin ortağa açık borcu görünmüyor.",
            fail_message="Şirketin ortağa açık borcu var. Bu kâr dağıtımından önce ayrıca izlenmelidir.",
        ),
        _check_item(
            key="profit_calculated",
            title="Kâr hesaplama",
            is_ok=is_profit_calculated,
            blocking=True,
            ok_message="Operasyonel kâr hesaplandı.",
            fail_message="Kâr hesaplanamadı.",
        ),
    ]

    blocking_issue_count = sum(1 for item in checklist if item.blocking and not item.is_ok)
    warning_count = sum(1 for item in checklist if item.severity == "warning")
    closure_ready = blocking_issue_count == 0

    return EventFinancialClosureChecklistResponse(
        event_id=event.id,
        event_title=event.title,
        event_status=event.status,
        period_month=_event_period_month(event),
        closure_ready=closure_ready,
        blocking_issue_count=blocking_issue_count,
        warning_count=warning_count,
        agreement_base_amount=agreement_base_amount,
        planned_base_amount=planned_base_amount,
        period_collected_base_amount=period_collected_base_amount,
        carried_customer_collection_base_amount=carried_customer_collection_base_amount,
        collected_base_amount=collected_base_amount,
        remaining_customer_receivable_base_amount=remaining_customer_receivable_base_amount,
        total_event_cost_base_amount=total_event_cost_base_amount,
        total_expense_base_amount=total_expense_base_amount,
        remaining_supplier_payable_base_amount=remaining_supplier_payable_base_amount,
        partner_cash_on_hand_base_amount=partner_cash_on_hand_base_amount,
        company_receivable_from_partner_base_amount=company_receivable_from_partner_base_amount,
        company_payable_to_partner_base_amount=company_payable_to_partner_base_amount,
        operational_profit_base_amount=operational_profit_base_amount,
        distributable_profit_base_amount=_round_money(distributable_profit_base_amount),
        partner_share_base_amount=partner_share_base_amount,
        is_agreement_confirmed=is_agreement_confirmed,
        is_payment_plan_matched=is_payment_plan_matched,
        is_collection_completed=is_collection_completed,
        are_costs_completed=are_costs_completed,
        are_expenses_completed=are_expenses_completed,
        are_supplier_debts_closed_or_carried=are_supplier_debts_closed_or_carried,
        are_partner_cash_items_closed_or_carried=are_partner_cash_items_closed_or_carried,
        is_profit_calculated=is_profit_calculated,
        is_partner_share_calculated=is_partner_share_calculated,
        checklist=checklist,
    )


def _apply_snapshot_to_closure(
    closure: EventFinancialClosure,
    snapshot: EventFinancialClosureChecklistResponse,
) -> None:
    closure.period_month = snapshot.period_month

    closure.agreement_base_amount = snapshot.agreement_base_amount
    closure.planned_base_amount = snapshot.planned_base_amount
    closure.collected_base_amount = snapshot.collected_base_amount
    closure.remaining_customer_receivable_base_amount = snapshot.remaining_customer_receivable_base_amount

    closure.total_event_cost_base_amount = snapshot.total_event_cost_base_amount
    closure.total_expense_base_amount = snapshot.total_expense_base_amount
    closure.remaining_supplier_payable_base_amount = snapshot.remaining_supplier_payable_base_amount

    closure.partner_cash_on_hand_base_amount = snapshot.partner_cash_on_hand_base_amount
    closure.company_receivable_from_partner_base_amount = snapshot.company_receivable_from_partner_base_amount
    closure.company_payable_to_partner_base_amount = snapshot.company_payable_to_partner_base_amount

    closure.operational_profit_base_amount = snapshot.operational_profit_base_amount
    closure.distributable_profit_base_amount = snapshot.distributable_profit_base_amount
    closure.partner_share_base_amount = snapshot.partner_share_base_amount

    closure.is_agreement_confirmed = snapshot.is_agreement_confirmed
    closure.is_payment_plan_matched = snapshot.is_payment_plan_matched
    closure.is_collection_completed = snapshot.is_collection_completed
    closure.are_costs_completed = snapshot.are_costs_completed
    closure.are_expenses_completed = snapshot.are_expenses_completed
    closure.are_supplier_debts_closed_or_carried = snapshot.are_supplier_debts_closed_or_carried
    closure.are_partner_cash_items_closed_or_carried = snapshot.are_partner_cash_items_closed_or_carried
    closure.is_profit_calculated = snapshot.is_profit_calculated
    closure.is_partner_share_calculated = snapshot.is_partner_share_calculated


def prepare_event_financial_closure(
    db: Session,
    *,
    event_id: int,
    payload: EventFinancialClosurePrepareRequest,
    current_user: User,
) -> EventFinancialClosureRead:
    event = _get_event_or_404(db=db, event_id=event_id)
    snapshot = calculate_event_financial_closure_snapshot(db=db, event_id=event_id)

    closure = EventFinancialClosure(
        event_id=event.id,
        monthly_period_id=None,
        period_month=snapshot.period_month,
        closure_version=_next_closure_version(db=db, event_id=event.id),
        status="prepared",
        prepared_by_user_id=current_user.id,
        prepared_at=datetime.now(timezone.utc),
        closing_note=payload.closing_note.strip() if payload.closing_note else None,
        notes=None,
    )

    _apply_snapshot_to_closure(closure=closure, snapshot=snapshot)

    db.add(closure)
    db.commit()
    db.refresh(closure)

    return EventFinancialClosureRead.model_validate(closure)


def approve_event_financial_closure(
    db: Session,
    *,
    event_id: int,
    payload: EventFinancialClosureApproveRequest,
    current_user: User,
) -> EventFinancialClosureRead:
    _get_event_or_404(db=db, event_id=event_id)

    snapshot = calculate_event_financial_closure_snapshot(db=db, event_id=event_id)

    if not snapshot.closure_ready:
        messages = [
            item.message
            for item in snapshot.checklist
            if item.blocking and not item.is_ok
        ]

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Etkinlik finansal kapanışa hazır değil.",
                "blocking_issues": messages,
            },
        )

    closure = _latest_closure(db=db, event_id=event_id)

    if closure is None or closure.status not in ("prepared", "open", "reopened"):
        closure = EventFinancialClosure(
            event_id=event_id,
            monthly_period_id=None,
            closure_version=_next_closure_version(db=db, event_id=event_id),
            status="prepared",
            prepared_by_user_id=current_user.id,
            prepared_at=datetime.now(timezone.utc),
        )
        db.add(closure)
        db.flush()

    _apply_snapshot_to_closure(closure=closure, snapshot=snapshot)

    closure.status = "approved"
    closure.approved_by_user_id = current_user.id
    closure.approved_at = datetime.now(timezone.utc)
    closure.notes = payload.approval_note.strip() if payload.approval_note else closure.notes

    db.commit()
    db.refresh(closure)

    return EventFinancialClosureRead.model_validate(closure)


def reopen_event_financial_closure(
    db: Session,
    *,
    event_id: int,
    payload: EventFinancialClosureReopenRequest,
    current_user: User,
) -> EventFinancialClosureRead:
    _get_event_or_404(db=db, event_id=event_id)

    closure = _latest_closure(db=db, event_id=event_id)

    if closure is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kapanış kaydı bulunamadı.",
        )

    if closure.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadece onaylanmış kapanış tekrar açılabilir.",
        )

    closure.status = "reopened"
    closure.reopened_by_user_id = current_user.id
    closure.reopened_at = datetime.now(timezone.utc)
    closure.reopen_reason = payload.reopen_reason.strip()

    db.commit()
    db.refresh(closure)

    return EventFinancialClosureRead.model_validate(closure)


def get_latest_event_financial_closure(
    db: Session,
    *,
    event_id: int,
) -> EventFinancialClosureRead | None:
    _get_event_or_404(db=db, event_id=event_id)

    closure = _latest_closure(db=db, event_id=event_id)

    if closure is None:
        return None

    return EventFinancialClosureRead.model_validate(closure)
