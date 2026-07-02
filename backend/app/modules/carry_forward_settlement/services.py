from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.finance import CarryForwardItem, EventSupplierPayable, EventSupplierPayment
from app.models.payment import CashAccount
from app.models.user import User
from app.modules.carry_forward_settlement.schemas import (
    CarryForwardItemDetail,
    CarryForwardSettlementRequest,
    CarryForwardSettlementResponse,
)
from app.modules.finance_engine.service import (
    create_financial_movement,
    record_supplier_payment_created,
)
from app.utils.money import D, money2


def _to_float(value) -> float:
    if value is None:
        return D(0)

    return D(value)


def _round_money(value) -> float:
    return money2(value)


def _is_penny_difference(value: float) -> bool:
    return abs(_round_money(value)) <= 0.01


def _get_item_or_404(db: Session, item_id: int) -> CarryForwardItem:
    item = db.get(CarryForwardItem, item_id)

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Devir kalemi bulunamadı.",
        )

    return item


def _get_cash_account_or_404(db: Session, cash_account_id: int | None) -> CashAccount:
    if cash_account_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu işlem için kasa/banka hesabı seçilmelidir.",
        )

    cash_account = db.get(CashAccount, cash_account_id)

    if cash_account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kasa/banka hesabı bulunamadı.",
        )

    if not cash_account.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pasif kasa/banka hesabı kullanılamaz.",
        )

    return cash_account


def _validate_settlement_amount(item: CarryForwardItem, amount: float) -> float:
    amount = _round_money(amount)
    remaining = _round_money(item.remaining_base_amount)

    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kapanış tutarı sıfırdan büyük olmalıdır.",
        )

    if remaining <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu devir kaleminin açık bakiyesi yok.",
        )

    # Para işlemleri kuruş hassasiyetinde çalışır.
    # Ekranda 0,01 TL görünen küçük yuvarlama farklarında kullanıcıyı engelleme.
    if amount > remaining:
        difference = _round_money(amount - remaining)

        if not _is_penny_difference(difference):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kapanış tutarı kalan devir tutarından büyük olamaz.",
            )

        amount = remaining

    return amount


def _apply_remaining_update(
    item: CarryForwardItem,
    *,
    amount: float,
    current_user: User,
    note: str | None,
) -> None:
    current_remaining = _round_money(item.remaining_base_amount)
    amount = _round_money(amount)
    new_remaining = _round_money(current_remaining - amount)

    if _is_penny_difference(new_remaining):
        new_remaining = 0

    item.remaining_base_amount = new_remaining

    if new_remaining <= 0:
        item.remaining_base_amount = 0
        item.status = "closed"
        item.closed_by_user_id = current_user.id
        item.closed_at = datetime.now(UTC)
        item.closure_note = note
    else:
        item.status = "partial"
        if note:
            item.notes = note


def _movement_common_kwargs(
    *,
    item: CarryForwardItem,
    payload: CarryForwardSettlementRequest,
    current_user: User,
    amount: float,
) -> dict:
    return {
        "movement_date": payload.settlement_date,
        "source_type": "carry_forward_item",
        "source_id": item.id,
        "amount": amount,
        "currency": item.currency,
        "exchange_rate": item.exchange_rate,
        "base_amount": amount,
        "event_id": item.event_id,
        "customer_id": item.customer_id,
        "partner_id": item.partner_id,
        "artist_id": item.artist_id,
        "service_item_id": item.service_item_id,
        "monthly_period_id": item.target_period_id,
        "movement_group_key": f"carry_forward_item:{item.id}",
        "document_no": payload.document_no,
        "notes": payload.notes,
        "created_by_user_id": current_user.id,
        "approved_by_user_id": current_user.id,
    }


def _settle_customer_receivable(
    db: Session,
    *,
    item: CarryForwardItem,
    payload: CarryForwardSettlementRequest,
    amount: float,
    current_user: User,
) -> list[int]:
    cash_account = _get_cash_account_or_404(db=db, cash_account_id=payload.cash_account_id)

    movement = create_financial_movement(
        db=db,
        **_movement_common_kwargs(
            item=item,
            payload=payload,
            current_user=current_user,
            amount=amount,
        ),
        movement_type="carry_forward_customer_collection",
        account_area="company_cash",
        direction="in",
        title="Devreden müşteri alacağı tahsil edildi",
        cash_account_id=cash_account.id,
        customer_effect="decrease_customer_receivable",
        cash_effect="increase_company_cash",
        partner_effect="none",
        profit_effect="none",
        description=(
            "Geçmiş dönemden devreden müşteri alacağı tahsil edildi. "
            "Tahsilat yeni dönem kasa hareketidir; yeni dönem kârını artırmaz."
        ),
    )

    db.flush()
    return [movement.id]


def _settle_supplier_payable(
    db: Session,
    *,
    item: CarryForwardItem,
    payload: CarryForwardSettlementRequest,
    amount: float,
    current_user: User,
) -> tuple[list[int], int | None]:
    cash_account = _get_cash_account_or_404(db=db, cash_account_id=payload.cash_account_id)

    payable = None

    if item.source_reference_type == "event_supplier_payable" and item.source_reference_id is not None:
        payable = db.get(EventSupplierPayable, item.source_reference_id)

    if payable is None:
        movement = create_financial_movement(
            db=db,
            **_movement_common_kwargs(
                item=item,
                payload=payload,
                current_user=current_user,
                amount=amount,
            ),
            movement_type="carry_forward_supplier_payment",
            account_area="company_cash",
            direction="out",
            title="Devreden sanatçı/hizmet borcu ödendi",
            cash_account_id=cash_account.id,
            customer_effect="none",
            cash_effect="decrease_company_cash",
            partner_effect="none",
            profit_effect="none",
            description=(
                "Geçmiş dönemden devreden sanatçı/hizmet borcu ödendi. "
                "Ödeme yeni dönem kasa hareketidir; yeni dönem giderini artırmaz."
            ),
        )

        db.flush()
        return [movement.id], None

    payment = EventSupplierPayment(
        payable_id=payable.id,
        event_id=payable.event_id,
        paid_by_partner_id=None,
        paid_by_user_id=current_user.id,
        cash_account_id=cash_account.id,
        payment_date=payload.settlement_date,
        amount=amount,
        currency=item.currency,
        exchange_rate=item.exchange_rate,
        base_amount=amount,
        payment_method=payload.payment_method,
        document_no=payload.document_no,
        notes=payload.notes,
        is_cancelled=False,
        cancellation_reason=None,
    )

    db.add(payment)

    payable.paid_base_amount = _round_money(_to_float(payable.paid_base_amount) + amount)
    payable.remaining_base_amount = _round_money(max(_to_float(payable.remaining_base_amount) - amount, 0))

    if payable.remaining_base_amount <= 0.0001:
        payable.remaining_base_amount = 0
        payable.status = "paid"
        payable.is_carried_forward = False
    elif payable.paid_base_amount > 0:
        payable.status = "partial"

    db.flush()

    movement = record_supplier_payment_created(
        db=db,
        payable=payable,
        payment=payment,
        current_user_id=current_user.id,
    )

    db.flush()

    return [movement.id] if movement is not None else [], payment.id


def _settle_partner_cash_on_hand(
    db: Session,
    *,
    item: CarryForwardItem,
    payload: CarryForwardSettlementRequest,
    amount: float,
    current_user: User,
) -> list[int]:
    cash_account = _get_cash_account_or_404(db=db, cash_account_id=payload.cash_account_id)

    if item.partner_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ortak üzerindeki para devrinde partner_id bulunmalıdır.",
        )

    common = _movement_common_kwargs(
        item=item,
        payload=payload,
        current_user=current_user,
        amount=amount,
    )

    partner_out = create_financial_movement(
        db=db,
        **common,
        movement_type="carry_forward_partner_cash_to_company",
        account_area="partner_cash_on_hand",
        direction="out",
        title="Devreden ortak üzerindeki para şirkete teslim edildi",
        cash_account_id=cash_account.id,
        customer_effect="none",
        cash_effect="decrease_partner_cash_on_hand",
        partner_effect="company_receivable_from_partner_decrease",
        profit_effect="none",
        description=(
            "Geçmiş dönemden devreden ortak üzerindeki şirket parası teslim alındı. "
            "Eski dönem raporu değişmez."
        ),
    )

    company_in = create_financial_movement(
        db=db,
        **common,
        movement_type="carry_forward_company_cash_from_partner",
        account_area="company_cash",
        direction="in",
        title="Devreden ortak tahsilatı şirket kasasına alındı",
        cash_account_id=cash_account.id,
        customer_effect="none",
        cash_effect="increase_company_cash",
        partner_effect="none",
        profit_effect="none",
        description=(
            "Geçmiş dönemden devreden ortak tahsilatı şirket kasasına girdi. "
            "Yeni dönem kârını artırmaz."
        ),
    )

    db.flush()
    return [partner_out.id, company_in.id]


def _settle_company_payable_to_partner(
    db: Session,
    *,
    item: CarryForwardItem,
    payload: CarryForwardSettlementRequest,
    amount: float,
    current_user: User,
) -> list[int]:
    cash_account = _get_cash_account_or_404(db=db, cash_account_id=payload.cash_account_id)

    if item.partner_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Şirketin ortağa borcu devrinde partner_id bulunmalıdır.",
        )

    movement = create_financial_movement(
        db=db,
        **_movement_common_kwargs(
            item=item,
            payload=payload,
            current_user=current_user,
            amount=amount,
        ),
        movement_type="carry_forward_company_payment_to_partner",
        account_area="company_cash",
        direction="out",
        title="Devreden şirketin ortağa borcu ödendi",
        cash_account_id=cash_account.id,
        customer_effect="none",
        cash_effect="decrease_company_cash",
        partner_effect="company_payable_to_partner_decrease",
        profit_effect="none",
        description=(
            "Geçmiş dönemden devreden şirketin ortağa borcu ödendi. "
            "Yeni dönem giderini artırmaz."
        ),
    )

    db.flush()
    return [movement.id]


def settle_carry_forward_item(
    db: Session,
    *,
    item_id: int,
    payload: CarryForwardSettlementRequest,
    current_user: User,
) -> CarryForwardSettlementResponse:
    item = _get_item_or_404(db=db, item_id=item_id)

    if item.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu devir kalemi zaten kapalı.",
        )

    if item.carry_type == "open_event":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Açık etkinlikler tek bir tahsilat veya ödeme hareketiyle kapatılamaz. Bu kalemler için gelir, tahsilat, maliyet, ödeme ve kâr/zarar hesabı ayrı bir Etkinlik Finans Kapanışı ekranında tamamlanmalıdır.",
        )

    amount = _validate_settlement_amount(item=item, amount=payload.amount)
    movement_ids: list[int] = []
    supplier_payment_id: int | None = None

    if item.carry_type == "customer_receivable":
        movement_ids = _settle_customer_receivable(
            db=db,
            item=item,
            payload=payload,
            amount=amount,
            current_user=current_user,
        )
    elif item.carry_type == "supplier_payable":
        movement_ids, supplier_payment_id = _settle_supplier_payable(
            db=db,
            item=item,
            payload=payload,
            amount=amount,
            current_user=current_user,
        )
    elif item.carry_type == "partner_cash_on_hand":
        movement_ids = _settle_partner_cash_on_hand(
            db=db,
            item=item,
            payload=payload,
            amount=amount,
            current_user=current_user,
        )
    elif item.carry_type == "company_payable_to_partner":
        movement_ids = _settle_company_payable_to_partner(
            db=db,
            item=item,
            payload=payload,
            amount=amount,
            current_user=current_user,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bu devir tipi için kapanış işlemi desteklenmiyor: {item.carry_type}",
        )

    _apply_remaining_update(
        item,
        amount=amount,
        current_user=current_user,
        note=payload.notes,
    )

    db.commit()
    db.refresh(item)

    return CarryForwardSettlementResponse(
        carry_forward_item_id=item.id,
        carry_type=item.carry_type,
        status=item.status,
        source_period_month=item.source_period_month,
        target_period_month=item.target_period_month,
        event_id=item.event_id,
        customer_id=item.customer_id,
        partner_id=item.partner_id,
        artist_id=item.artist_id,
        service_item_id=item.service_item_id,
        settled_base_amount=amount,
        remaining_base_amount=_round_money(item.remaining_base_amount),
        settlement_date=payload.settlement_date,
        movement_ids=movement_ids,
        created_supplier_payment_id=supplier_payment_id,
        message="Devir kalemi işlendi. Eski dönem raporu değiştirilmedi.",
    )


def get_carry_forward_item(
    db: Session,
    *,
    item_id: int,
) -> CarryForwardItemDetail:
    item = _get_item_or_404(db=db, item_id=item_id)
    return CarryForwardItemDetail.model_validate(item)


def list_open_carry_forward_items(
    db: Session,
    *,
    target_period_month: str | None = None,
    source_period_month: str | None = None,
    carry_type: str | None = None,
) -> list[CarryForwardItemDetail]:
    query = db.query(CarryForwardItem).filter(CarryForwardItem.status != "closed")

    if target_period_month is not None:
        query = query.filter(CarryForwardItem.target_period_month == target_period_month)

    if source_period_month is not None:
        query = query.filter(CarryForwardItem.source_period_month == source_period_month)

    if carry_type is not None:
        query = query.filter(CarryForwardItem.carry_type == carry_type)

    items = query.order_by(CarryForwardItem.target_period_month.asc(), CarryForwardItem.id.asc()).all()

    return [CarryForwardItemDetail.model_validate(item) for item in items]
