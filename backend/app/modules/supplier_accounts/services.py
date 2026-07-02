from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.artist import Artist, ServiceItem
from app.models.event import Event
from app.models.finance import EventSupplierPayable, EventSupplierPayment
from app.modules.supplier_accounts.schemas import (
    SupplierAccountBalanceItem,
    SupplierAccountBalancesResponse,
    SupplierAccountBalancesSummary,
    SupplierAccountStatementLine,
    SupplierAccountStatementResponse,
    SupplierAccountStatementSummary,
)
from app.utils.money import D, money, rate


def _to_float(value) -> float:
    if value is None:
        return D(0)

    return D(value)


def _date_from_datetime(value, fallback: date) -> date:
    if value is None:
        return fallback

    if hasattr(value, "date"):
        return value.date()

    return fallback


def _get_supplier_or_404(
    db: Session,
    *,
    supplier_kind: str,
    supplier_id: int,
) -> tuple[str, str]:
    if supplier_kind == "artist":
        artist = db.get(Artist, supplier_id)

        if artist is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sanatçı bulunamadı.",
            )

        return "artist", artist.name

    if supplier_kind == "service":
        service_item = db.get(ServiceItem, supplier_id)

        if service_item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hizmet sağlayıcı/kalemi bulunamadı.",
            )

        return "service", service_item.name

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Geçersiz cari türü.",
    )


def _get_event_title(db: Session, event_id: int | None) -> str | None:
    if event_id is None:
        return None

    event = db.get(Event, event_id)

    if event is None:
        return None

    return event.title


def _filter_by_supplier(query, *, supplier_kind: str, supplier_id: int):
    if supplier_kind == "artist":
        return query.filter(EventSupplierPayable.artist_id == supplier_id)

    return query.filter(EventSupplierPayable.service_item_id == supplier_id)


def _get_payables(
    db: Session,
    *,
    supplier_kind: str,
    supplier_id: int,
    event_id: int | None,
) -> list[EventSupplierPayable]:
    query = db.query(EventSupplierPayable)
    query = _filter_by_supplier(query, supplier_kind=supplier_kind, supplier_id=supplier_id)

    if event_id is not None:
        query = query.filter(EventSupplierPayable.event_id == event_id)

    return query.order_by(EventSupplierPayable.id.asc()).all()


def _get_payments_for_payables(
    db: Session,
    *,
    payable_ids: list[int],
    include_cancelled: bool,
) -> list[EventSupplierPayment]:
    if not payable_ids:
        return []

    query = db.query(EventSupplierPayment).filter(EventSupplierPayment.payable_id.in_(payable_ids))

    if not include_cancelled:
        query = query.filter(EventSupplierPayment.is_cancelled == False)  # noqa: E712

    return query.order_by(EventSupplierPayment.payment_date.asc(), EventSupplierPayment.id.asc()).all()


def _payment_source(payment: EventSupplierPayment) -> str:
    if payment.paid_by_partner_id is not None:
        return "partner"

    if payment.cash_account_id is not None:
        return "company_cash"

    return "unknown"


def get_supplier_account_statement(
    db: Session,
    *,
    supplier_kind: str,
    supplier_id: int,
    event_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    include_cancelled: bool = True,
) -> SupplierAccountStatementResponse:
    supplier_kind, supplier_name = _get_supplier_or_404(
        db=db,
        supplier_kind=supplier_kind,
        supplier_id=supplier_id,
    )

    payables = _get_payables(
        db=db,
        supplier_kind=supplier_kind,
        supplier_id=supplier_id,
        event_id=event_id,
    )

    payable_ids = [item.id for item in payables]

    payments = _get_payments_for_payables(
        db=db,
        payable_ids=payable_ids,
        include_cancelled=include_cancelled,
    )

    raw_lines: list[dict] = []

    for payable in payables:
        line_date = payable.due_date or payable.created_at.date()

        raw_lines.append(
            {
                "sort_date": line_date,
                "sort_order": 10,
                "line_date": line_date,
                "event_id": payable.event_id,
                "event_title": _get_event_title(db=db, event_id=payable.event_id),
                "reference_type": "supplier_payable",
                "reference_id": payable.id,
                "transaction_type": "payable_created",
                "title": "Borç oluştu",
                "description": payable.title,
                "debit_base_amount": _to_float(payable.base_amount),
                "credit_base_amount": D(0),
                "source_amount": _to_float(payable.amount),
                "source_currency": payable.currency,
                "exchange_rate": _to_float(payable.exchange_rate),
                "payment_source": None,
                "payment_method": None,
                "document_no": None,
                "status": payable.status,
                "notes": payable.notes,
            }
        )

    payable_by_id = {item.id: item for item in payables}

    for payment in payments:
        payable = payable_by_id.get(payment.payable_id)

        if payable is None:
            continue

        raw_lines.append(
            {
                "sort_date": payment.payment_date,
                "sort_order": 20,
                "line_date": payment.payment_date,
                "event_id": payment.event_id,
                "event_title": _get_event_title(db=db, event_id=payment.event_id),
                "reference_type": "supplier_payment",
                "reference_id": payment.id,
                "transaction_type": "payment_created_cancelled" if payment.is_cancelled else "payment_created",
                "title": "Ödeme yapıldı" if not payment.is_cancelled else "Ödeme yapıldı (sonradan iptal edildi)",
                "description": payable.title,
                "debit_base_amount": D(0),
                "credit_base_amount": _to_float(payment.base_amount),
                "source_amount": _to_float(payment.amount),
                "source_currency": payment.currency,
                "exchange_rate": _to_float(payment.exchange_rate),
                "payment_source": _payment_source(payment),
                "payment_method": payment.payment_method,
                "document_no": payment.document_no,
                "status": "cancelled" if payment.is_cancelled else "approved",
                "notes": payment.notes,
            }
        )

        if payment.is_cancelled and include_cancelled:
            cancel_date = _date_from_datetime(payment.updated_at, payment.payment_date)

            raw_lines.append(
                {
                    "sort_date": cancel_date,
                    "sort_order": 30,
                    "line_date": cancel_date,
                    "event_id": payment.event_id,
                    "event_title": _get_event_title(db=db, event_id=payment.event_id),
                    "reference_type": "supplier_payment_cancel",
                    "reference_id": payment.id,
                    "transaction_type": "payment_cancelled",
                    "title": "Ödeme iptal edildi",
                    "description": payable.title,
                    "debit_base_amount": _to_float(payment.base_amount),
                    "credit_base_amount": D(0),
                    "source_amount": _to_float(payment.amount),
                    "source_currency": payment.currency,
                    "exchange_rate": _to_float(payment.exchange_rate),
                    "payment_source": _payment_source(payment),
                    "payment_method": payment.payment_method,
                    "document_no": payment.document_no,
                    "status": "approved",
                    "notes": payment.cancellation_reason or payment.notes,
                }
            )

    if date_from is not None:
        raw_lines = [item for item in raw_lines if item["line_date"] >= date_from]

    if date_to is not None:
        raw_lines = [item for item in raw_lines if item["line_date"] <= date_to]

    raw_lines.sort(
        key=lambda item: (
            item["sort_date"],
            item["sort_order"],
            item["reference_id"],
        )
    )

    balance = D(0)
    total_debit = D(0)
    total_credit = D(0)
    items: list[SupplierAccountStatementLine] = []

    for index, item in enumerate(raw_lines, start=1):
        debit = money(_to_float(item["debit_base_amount"]))
        credit = money(_to_float(item["credit_base_amount"]))

        total_debit += debit
        total_credit += credit
        balance = money(balance + debit - credit)

        items.append(
            SupplierAccountStatementLine(
                line_no=index,
                line_date=item["line_date"],
                supplier_kind=supplier_kind,
                supplier_id=supplier_id,
                supplier_name=supplier_name,
                event_id=item["event_id"],
                event_title=item["event_title"],
                reference_type=item["reference_type"],
                reference_id=item["reference_id"],
                transaction_type=item["transaction_type"],
                title=item["title"],
                description=item["description"],
                debit_base_amount=debit,
                credit_base_amount=credit,
                balance_base_amount=balance,
                source_amount=money(_to_float(item["source_amount"])),
                source_currency=item["source_currency"],
                exchange_rate=rate(item["exchange_rate"]),
                payment_source=item["payment_source"],
                payment_method=item["payment_method"],
                document_no=item["document_no"],
                status=item["status"],
                notes=item["notes"],
            )
        )

    summary = SupplierAccountStatementSummary(
        supplier_kind=supplier_kind,
        supplier_id=supplier_id,
        supplier_name=supplier_name,
        total_debit_base_amount=money(total_debit),
        total_credit_base_amount=money(total_credit),
        balance_base_amount=money(balance),
        open_payable_count=sum(1 for item in payables if item.status == "open"),
        partial_payable_count=sum(1 for item in payables if item.status == "partial"),
        paid_payable_count=sum(1 for item in payables if item.status == "paid"),
        line_count=len(items),
    )

    return SupplierAccountStatementResponse(
        summary=summary,
        items=items,
    )

def _get_supplier_balance_payables(
    db: Session,
    *,
    supplier_kind: str,
    supplier_id: int,
    event_id: int | None,
) -> list[EventSupplierPayable]:
    query = db.query(EventSupplierPayable)

    if supplier_kind == "artist":
        query = query.filter(EventSupplierPayable.artist_id == supplier_id)
    else:
        query = query.filter(EventSupplierPayable.service_item_id == supplier_id)

    if event_id is not None:
        query = query.filter(EventSupplierPayable.event_id == event_id)

    return query.order_by(EventSupplierPayable.id.asc()).all()


def _get_supplier_balance_candidates(
    db: Session,
    *,
    kind: str,
    include_inactive: bool,
) -> list[dict]:
    candidates: list[dict] = []

    if kind in ("all", "artist"):
        artist_query = db.query(Artist)

        if not include_inactive:
            artist_query = artist_query.filter(Artist.is_active == True)  # noqa: E712

        artists = artist_query.order_by(Artist.name.asc()).all()

        for artist in artists:
            candidates.append(
                {
                    "supplier_kind": "artist",
                    "supplier_id": artist.id,
                    "supplier_name": artist.name,
                    "is_active": bool(artist.is_active),
                }
            )

    if kind in ("all", "service"):
        service_query = db.query(ServiceItem)

        if not include_inactive:
            service_query = service_query.filter(ServiceItem.is_active == True)  # noqa: E712

        service_items = service_query.order_by(ServiceItem.name.asc()).all()

        for service_item in service_items:
            candidates.append(
                {
                    "supplier_kind": "service",
                    "supplier_id": service_item.id,
                    "supplier_name": service_item.name,
                    "is_active": bool(service_item.is_active),
                }
            )

    return candidates


def get_supplier_account_balances(
    db: Session,
    *,
    kind: str = "all",
    event_id: int | None = None,
    only_with_balance: bool = False,
    include_inactive: bool = False,
) -> SupplierAccountBalancesResponse:
    kind = (kind or "all").strip().lower()

    if kind not in ("all", "artist", "service"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz cari türü. all, artist veya service kullanılmalıdır.",
        )

    candidates = _get_supplier_balance_candidates(
        db=db,
        kind=kind,
        include_inactive=include_inactive,
    )

    items: list[SupplierAccountBalanceItem] = []

    for candidate in candidates:
        payables = _get_supplier_balance_payables(
            db=db,
            supplier_kind=candidate["supplier_kind"],
            supplier_id=candidate["supplier_id"],
            event_id=event_id,
        )

        payable_ids = [item.id for item in payables]
        payments = _get_payments_for_payables(
            db=db,
            payable_ids=payable_ids,
            include_cancelled=False,
        )

        total_debit = money(sum(_to_float(item.base_amount) for item in payables))
        total_credit = money(sum(_to_float(item.base_amount) for item in payments))
        balance = money(total_debit - total_credit)

        if only_with_balance and abs(balance) <= 0.0001:
            continue

        transaction_dates: list[date] = []

        for payable in payables:
            if payable.due_date is not None:
                transaction_dates.append(payable.due_date)
            elif payable.created_at is not None:
                transaction_dates.append(payable.created_at.date())

        for payment in payments:
            transaction_dates.append(payment.payment_date)

        event_ids = {item.event_id for item in payables if item.event_id is not None}

        items.append(
            SupplierAccountBalanceItem(
                supplier_kind=candidate["supplier_kind"],
                supplier_id=candidate["supplier_id"],
                supplier_name=candidate["supplier_name"],
                is_active=candidate["is_active"],
                total_debit_base_amount=total_debit,
                total_credit_base_amount=total_credit,
                balance_base_amount=balance,
                payable_count=len(payables),
                payment_count=len(payments),
                open_payable_count=sum(1 for item in payables if item.status == "open"),
                partial_payable_count=sum(1 for item in payables if item.status == "partial"),
                paid_payable_count=sum(1 for item in payables if item.status == "paid"),
                event_count=len(event_ids),
                last_transaction_date=max(transaction_dates) if transaction_dates else None,
            )
        )

    items.sort(
        key=lambda item: (
            0 if item.balance_base_amount > 0 else 1,
            item.supplier_kind,
            item.supplier_name.lower(),
        )
    )

    total_debit = money(sum(item.total_debit_base_amount for item in items))
    total_credit = money(sum(item.total_credit_base_amount for item in items))
    total_balance = money(sum(item.balance_base_amount for item in items))

    summary = SupplierAccountBalancesSummary(
        kind=kind,
        total_supplier_count=len(items),
        total_debit_base_amount=total_debit,
        total_credit_base_amount=total_credit,
        total_balance_base_amount=total_balance,
        positive_balance_supplier_count=sum(1 for item in items if item.balance_base_amount > 0.0001),
        zero_balance_supplier_count=sum(1 for item in items if abs(item.balance_base_amount) <= 0.0001),
        negative_balance_supplier_count=sum(1 for item in items if item.balance_base_amount < -0.0001),
    )

    return SupplierAccountBalancesResponse(
        summary=summary,
        items=items,
    )
