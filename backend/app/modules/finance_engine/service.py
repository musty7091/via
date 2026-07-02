from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.finance import EventSupplierPayable, EventSupplierPayment, FinancialMovement
from app.models.payment import CashTransfer, Collection
from app.models.period import MonthlyPeriod
from app.utils.money import D, money
from app.utils.money import rate as rate_q


def _period_month(value: date | None) -> str | None:
    if value is None:
        return None

    return value.strftime("%Y-%m")


def assert_period_open(db: Session, movement_date: date | None) -> None:
    """Kapatılmış bir döneme işlem eklenmesini/değiştirilmesini engeller.

    Dönem `status == "closed"` veya `is_locked` ise, o aya tarihli her yeni
    finansal hareket reddedilir (409). Bu, kapanmış dönemin muhasebe
    bütünlüğünü korur.
    """
    period_month = _period_month(movement_date)
    if not period_month:
        return

    period = (
        db.query(MonthlyPeriod)
        .filter(MonthlyPeriod.period_month == period_month)
        .first()
    )
    if period is not None and (period.is_locked or period.status == "closed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{period_month} dönemi kapatılmıştır; bu döneme yeni işlem "
                "eklenemez veya mevcut işlemler değiştirilemez."
            ),
        )


def assert_event_period_open(event) -> None:
    """Etkinlik kapatılmış bir döneme aitse ilgili işlemleri engeller (409).

    Etkinliğin `is_period_closed` bayrağı kapanış sırasında True yapılır; bu
    etkinliğin durum/plan/kapanış gibi mutasyonları kilitlenir.
    """
    if getattr(event, "is_period_closed", False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Bu etkinlik kapatılmış bir döneme ait; durum/plan/kapanış "
                "değişikliği yapılamaz."
            ),
        )


def _to_decimal(value):
    return D(value)


def _movement_exists(
    db: Session,
    source_type: str,
    source_id: int,
    movement_type: str,
) -> bool:
    existing = (
        db.query(FinancialMovement)
        .filter(
            FinancialMovement.source_type == source_type,
            FinancialMovement.source_id == source_id,
            FinancialMovement.movement_type == movement_type,
            FinancialMovement.is_cancelled == False,  # noqa: E712
        )
        .first()
    )

    return existing is not None


def create_financial_movement(
    db: Session,
    *,
    movement_date: date,
    source_type: str,
    source_id: int | None,
    movement_type: str,
    account_area: str,
    direction: str,
    amount: Decimal,
    currency: str,
    exchange_rate: Decimal,
    base_amount: Decimal,
    title: str,
    event_id: int | None = None,
    customer_id: int | None = None,
    partner_id: int | None = None,
    artist_id: int | None = None,
    service_item_id: int | None = None,
    cash_account_id: int | None = None,
    monthly_period_id: int | None = None,
    movement_group_key: str | None = None,
    customer_effect: str = "none",
    cash_effect: str = "none",
    partner_effect: str = "none",
    profit_effect: str = "none",
    document_no: str | None = None,
    description: str | None = None,
    notes: str | None = None,
    status: str = "approved",
    created_by_user_id: int | None = None,
    approved_by_user_id: int | None = None,
) -> FinancialMovement:
    # Kapatılmış döneme işlem eklenmesini engelle (muhasebe kilidi)
    assert_period_open(db, movement_date)

    movement = FinancialMovement(
        movement_date=movement_date,
        period_month=_period_month(movement_date),
        source_type=source_type,
        source_id=source_id,
        movement_group_key=movement_group_key,
        event_id=event_id,
        customer_id=customer_id,
        partner_id=partner_id,
        artist_id=artist_id,
        service_item_id=service_item_id,
        cash_account_id=cash_account_id,
        monthly_period_id=monthly_period_id,
        movement_type=movement_type,
        account_area=account_area,
        direction=direction,
        amount=money(amount),
        currency=currency,
        exchange_rate=rate_q(exchange_rate) or D(1),
        base_amount=money(base_amount),
        customer_effect=customer_effect,
        cash_effect=cash_effect,
        partner_effect=partner_effect,
        profit_effect=profit_effect,
        document_no=document_no,
        title=title,
        description=description,
        notes=notes,
        status=status,
        created_by_user_id=created_by_user_id,
        approved_by_user_id=approved_by_user_id,
        is_cancelled=False,
        cancellation_reason=None,
        reversed_movement_id=None,
    )

    db.add(movement)
    return movement


def record_collection_created(
    db: Session,
    *,
    collection: Collection,
    current_user_id: int | None,
) -> FinancialMovement | None:
    if collection.is_cancelled:
        return None

    if _movement_exists(
        db=db,
        source_type="collection",
        source_id=collection.id,
        movement_type="collection_created",
    ):
        return None

    is_partner_collection = collection.received_by_partner_id is not None

    if is_partner_collection:
        account_area = "partner_cash_on_hand"
        cash_effect = "increase_partner_cash_on_hand"
        partner_effect = "company_receivable_from_partner_increase"
        title = "Ortak tarafından tahsilat alındı"
        description = (
            "Müşteri borcu azalır. Şirket kasası artmaz. "
            "Para ortağın üzerinde şirket emaneti olarak izlenir."
        )
    else:
        account_area = "company_cash"
        cash_effect = "increase_company_cash"
        partner_effect = "none"
        title = "Şirket tarafından tahsilat alındı"
        description = "Müşteri borcu azalır ve para şirket kasası/banka tarafında izlenir."

    return create_financial_movement(
        db=db,
        movement_date=collection.collection_date,
        source_type="collection",
        source_id=collection.id,
        movement_type="collection_created",
        account_area=account_area,
        direction="in",
        amount=collection.amount,
        currency=collection.currency,
        exchange_rate=collection.exchange_rate,
        base_amount=collection.base_amount,
        title=title,
        event_id=collection.event_id,
        customer_id=collection.customer_id,
        partner_id=collection.received_by_partner_id,
        movement_group_key=f"collection:{collection.id}",
        customer_effect="decrease_customer_receivable",
        cash_effect=cash_effect,
        partner_effect=partner_effect,
        profit_effect="collection_progress",
        document_no=collection.document_no,
        description=description,
        notes=collection.notes,
        created_by_user_id=current_user_id,
        approved_by_user_id=current_user_id,
    )


def record_collection_transferred_to_company(
    db: Session,
    *,
    collection: Collection,
    cash_transfer: CashTransfer,
    current_user_id: int | None,
) -> list[FinancialMovement]:
    if collection.is_cancelled:
        return []

    if _movement_exists(
        db=db,
        source_type="cash_transfer",
        source_id=cash_transfer.id,
        movement_type="partner_cash_transfer_to_company",
    ):
        return []

    if _movement_exists(
        db=db,
        source_type="cash_transfer",
        source_id=cash_transfer.id,
        movement_type="company_cash_transfer_from_partner",
    ):
        return []

    movement_group_key = f"cash_transfer:{cash_transfer.id}"

    partner_out = create_financial_movement(
        db=db,
        movement_date=cash_transfer.transfer_date,
        source_type="cash_transfer",
        source_id=cash_transfer.id,
        movement_type="partner_cash_transfer_to_company",
        account_area="partner_cash_on_hand",
        direction="out",
        amount=cash_transfer.amount,
        currency=cash_transfer.currency,
        exchange_rate=cash_transfer.exchange_rate,
        base_amount=cash_transfer.base_amount,
        title="Ortak üzerindeki tahsilat şirkete teslim edildi",
        event_id=collection.event_id,
        customer_id=collection.customer_id,
        partner_id=cash_transfer.from_partner_id,
        cash_account_id=cash_transfer.to_cash_account_id,
        movement_group_key=movement_group_key,
        customer_effect="none",
        cash_effect="decrease_partner_cash_on_hand",
        partner_effect="company_receivable_from_partner_decrease",
        profit_effect="none",
        document_no=cash_transfer.document_no,
        description=(
            "Müşteri cari tekrar etkilenmez. Daha önce ortağın üzerinde görünen "
            "şirket emaneti azaltılır."
        ),
        notes=cash_transfer.notes,
        created_by_user_id=current_user_id,
        approved_by_user_id=current_user_id,
    )

    company_in = create_financial_movement(
        db=db,
        movement_date=cash_transfer.transfer_date,
        source_type="cash_transfer",
        source_id=cash_transfer.id,
        movement_type="company_cash_transfer_from_partner",
        account_area="company_cash",
        direction="in",
        amount=cash_transfer.amount,
        currency=cash_transfer.currency,
        exchange_rate=cash_transfer.exchange_rate,
        base_amount=cash_transfer.base_amount,
        title="Ortak tahsilatı şirket kasasına/bankasına alındı",
        event_id=collection.event_id,
        customer_id=collection.customer_id,
        partner_id=cash_transfer.from_partner_id,
        cash_account_id=cash_transfer.to_cash_account_id,
        movement_group_key=movement_group_key,
        customer_effect="none",
        cash_effect="increase_company_cash",
        partner_effect="none",
        profit_effect="none",
        document_no=cash_transfer.document_no,
        description=(
            "Müşteri cari tekrar etkilenmez. Para şirket kasa/banka hesabına "
            "giriş olarak izlenir."
        ),
        notes=cash_transfer.notes,
        created_by_user_id=current_user_id,
        approved_by_user_id=current_user_id,
    )

    return [partner_out, company_in]


def record_collection_cancelled(
    db: Session,
    *,
    collection: Collection,
    current_user_id: int | None,
) -> FinancialMovement | None:
    if not collection.is_cancelled:
        return None

    if _movement_exists(
        db=db,
        source_type="collection",
        source_id=collection.id,
        movement_type="collection_cancelled",
    ):
        return None

    is_partner_collection = collection.received_by_partner_id is not None

    if is_partner_collection:
        account_area = "partner_cash_on_hand"
        cash_effect = "decrease_partner_cash_on_hand"
        partner_effect = "company_receivable_from_partner_decrease"
        title = "Ortak tahsilatı iptal edildi"
        description = (
            "İptal nedeniyle müşteri borcu tekrar artar. "
            "Ortak üzerindeki şirket emaneti azaltılır."
        )
    else:
        account_area = "company_cash"
        cash_effect = "decrease_company_cash"
        partner_effect = "none"
        title = "Şirket tahsilatı iptal edildi"
        description = "İptal nedeniyle müşteri borcu tekrar artar ve şirket para hareketi terslenir."

    return create_financial_movement(
        db=db,
        movement_date=collection.collection_date,
        source_type="collection",
        source_id=collection.id,
        movement_type="collection_cancelled",
        account_area=account_area,
        direction="out",
        amount=collection.amount,
        currency=collection.currency,
        exchange_rate=collection.exchange_rate,
        base_amount=collection.base_amount,
        title=title,
        event_id=collection.event_id,
        customer_id=collection.customer_id,
        partner_id=collection.received_by_partner_id,
        movement_group_key=f"collection:{collection.id}",
        customer_effect="increase_customer_receivable",
        cash_effect=cash_effect,
        partner_effect=partner_effect,
        profit_effect="collection_reversal",
        document_no=collection.document_no,
        description=description,
        notes=collection.cancellation_reason or collection.notes,
        created_by_user_id=current_user_id,
        approved_by_user_id=current_user_id,
    )

def record_supplier_payable_created(
    db: Session,
    *,
    payable: EventSupplierPayable,
    current_user_id: int | None,
) -> FinancialMovement | None:
    if _movement_exists(
        db=db,
        source_type="event_supplier_payable",
        source_id=payable.id,
        movement_type="supplier_payable_created",
    ):
        return None

    movement_date = payable.due_date or date.today()

    return create_financial_movement(
        db=db,
        movement_date=movement_date,
        source_type="event_supplier_payable",
        source_id=payable.id,
        movement_type="supplier_payable_created",
        account_area="supplier_payable",
        direction="out",
        amount=payable.amount,
        currency=payable.currency,
        exchange_rate=payable.exchange_rate,
        base_amount=payable.base_amount,
        title="Sanatçı/hizmet sağlayıcı borcu oluştu",
        event_id=payable.event_id,
        artist_id=payable.artist_id,
        service_item_id=payable.service_item_id,
        movement_group_key=f"supplier_payable:{payable.id}",
        customer_effect="none",
        cash_effect="none",
        partner_effect="none",
        profit_effect="decrease_operational_profit",
        document_no=None,
        description="Etkinlik maliyeti oluştu. Nakit çıkışı henüz gerçekleşmedi.",
        notes=payable.notes,
        created_by_user_id=current_user_id,
        approved_by_user_id=current_user_id,
    )


def record_supplier_payment_created(
    db: Session,
    *,
    payable: EventSupplierPayable,
    payment: EventSupplierPayment,
    current_user_id: int | None,
) -> FinancialMovement | None:
    if payment.is_cancelled:
        return None

    if _movement_exists(
        db=db,
        source_type="event_supplier_payment",
        source_id=payment.id,
        movement_type="supplier_payment_created",
    ):
        return None

    is_partner_payment = payment.paid_by_partner_id is not None

    if is_partner_payment:
        account_area = "partner_supplier_payment"
        cash_effect = "none"
        partner_effect = "company_payable_to_partner_increase"
        title = "Ortak sanatçı/hizmet borcu ödedi"
        description = (
            "Şirket kasası etkilenmez. Ortağın şirketten alacağı oluşur. "
            "Sanatçı/hizmet borcu azalır."
        )
    else:
        account_area = "company_cash"
        cash_effect = "decrease_company_cash"
        partner_effect = "none"
        title = "Şirket sanatçı/hizmet borcu ödedi"
        description = "Şirket kasa/banka çıkışı oluşur. Sanatçı/hizmet borcu azalır."

    return create_financial_movement(
        db=db,
        movement_date=payment.payment_date,
        source_type="event_supplier_payment",
        source_id=payment.id,
        movement_type="supplier_payment_created",
        account_area=account_area,
        direction="out",
        amount=payment.amount,
        currency=payment.currency,
        exchange_rate=payment.exchange_rate,
        base_amount=payment.base_amount,
        title=title,
        event_id=payment.event_id,
        partner_id=payment.paid_by_partner_id,
        artist_id=payable.artist_id,
        service_item_id=payable.service_item_id,
        cash_account_id=payment.cash_account_id,
        movement_group_key=f"supplier_payment:{payment.id}",
        customer_effect="none",
        cash_effect=cash_effect,
        partner_effect=partner_effect,
        profit_effect="none",
        document_no=payment.document_no,
        description=description,
        notes=payment.notes,
        created_by_user_id=current_user_id,
        approved_by_user_id=current_user_id,
    )


def record_supplier_payment_cancelled(
    db: Session,
    *,
    payable: EventSupplierPayable,
    payment: EventSupplierPayment,
    current_user_id: int | None,
) -> FinancialMovement | None:
    if not payment.is_cancelled:
        return None

    if _movement_exists(
        db=db,
        source_type="event_supplier_payment",
        source_id=payment.id,
        movement_type="supplier_payment_cancelled",
    ):
        return None

    is_partner_payment = payment.paid_by_partner_id is not None

    if is_partner_payment:
        account_area = "partner_supplier_payment"
        cash_effect = "none"
        partner_effect = "company_payable_to_partner_decrease"
        title = "Ortak tarafından yapılan sanatçı/hizmet ödemesi iptal edildi"
        description = (
            "Sanatçı/hizmet borcu tekrar artar. Ortağın şirketten alacağı azaltılır."
        )
    else:
        account_area = "company_cash"
        cash_effect = "increase_company_cash"
        partner_effect = "none"
        title = "Şirket sanatçı/hizmet ödemesi iptal edildi"
        description = "Sanatçı/hizmet borcu tekrar artar ve şirket kasa/banka hareketi terslenir."

    return create_financial_movement(
        db=db,
        movement_date=payment.payment_date,
        source_type="event_supplier_payment",
        source_id=payment.id,
        movement_type="supplier_payment_cancelled",
        account_area=account_area,
        direction="in",
        amount=payment.amount,
        currency=payment.currency,
        exchange_rate=payment.exchange_rate,
        base_amount=payment.base_amount,
        title=title,
        event_id=payment.event_id,
        partner_id=payment.paid_by_partner_id,
        artist_id=payable.artist_id,
        service_item_id=payable.service_item_id,
        cash_account_id=payment.cash_account_id,
        movement_group_key=f"supplier_payment:{payment.id}",
        customer_effect="none",
        cash_effect=cash_effect,
        partner_effect=partner_effect,
        profit_effect="none",
        document_no=payment.document_no,
        description=description,
        notes=payment.cancellation_reason or payment.notes,
        created_by_user_id=current_user_id,
        approved_by_user_id=current_user_id,
    )
