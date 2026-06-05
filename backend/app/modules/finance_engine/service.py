from datetime import date

from sqlalchemy.orm import Session

from app.models.finance import FinancialMovement
from app.models.payment import CashTransfer, Collection


def _to_float(value) -> float:
    if value is None:
        return 0.0

    return float(value)


def _period_month(value: date | None) -> str | None:
    if value is None:
        return None

    return value.strftime("%Y-%m")


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
    amount: float,
    currency: str,
    exchange_rate: float,
    base_amount: float,
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
        amount=_to_float(amount),
        currency=currency,
        exchange_rate=_to_float(exchange_rate) or 1,
        base_amount=_to_float(base_amount),
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
