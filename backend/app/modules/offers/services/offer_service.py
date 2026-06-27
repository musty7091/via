from collections import defaultdict
from datetime import date
from decimal import Decimal

from app.utils.money import D, money, percent_of

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.artist import Artist, ServiceItem
from app.models.customer import Customer
from app.models.event import Event, EventItem
from app.models.offer import Offer, OfferItem
from app.models.service_package import ServicePackage, ServicePackageItem
from app.models.venue import Venue
from app.modules.offers import constants
from app.modules.offers.repositories import offer_repository
from app.modules.offers.schemas import (
    ConvertAgreementRequest,
    ImportPackageRequest,
    OfferCreate,
    OfferDetail,
    OfferInternalItemRead,
    OfferInternalSummary,
    OfferItemCreate,
    OfferPrintLine,
    OfferPrintView,
    OfferRead,
    OfferSummary,
    OfferUpdate,
)


def _dec(value) -> Decimal:
    return D(value)


def _validate_choice(field_name: str, value: str | None, allowed: list[str]) -> None:
    if value is None:
        return

    if value not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} geçersiz. Geçerli değerler: {', '.join(allowed)}",
        )


def _validate_offer_refs(
    db: Session,
    customer_id: int,
    venue_id: int | None,
    package_id: int | None,
) -> None:
    if db.get(Customer, customer_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Müşteri bulunamadı.",
        )

    if venue_id is not None and db.get(Venue, venue_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mekân bulunamadı.",
        )

    if package_id is not None and db.get(ServicePackage, package_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Program paketi bulunamadı.",
        )


def _next_offer_no(db: Session) -> str:
    last_offer = db.query(Offer).order_by(Offer.id.desc()).first()
    next_id = (last_offer.id + 1) if last_offer else 1
    return f"VIA-TEK-{date.today().year}-{next_id:05d}"


def _line_amount(quantity: float, unit_price: float) -> float:
    return money(D(quantity) * D(unit_price))


def _recalculate_offer(db: Session, offer: Offer) -> Offer:
    items = offer_repository.list_offer_items(db=db, offer_id=offer.id)
    visible_items = [item for item in items if item.is_visible_on_offer]

    currency_totals: dict[str, float] = defaultdict(lambda: D(0))

    for item in visible_items:
        currency_totals[item.currency] += _dec(item.base_amount)

    primary_currency = offer.currency or "TRY"
    primary_amount = money(currency_totals.get(primary_currency, 0))

    vat_amount = 0

    if offer.invoice_type == "with_invoice":
        vat_amount = money(primary_amount * (_dec(offer.vat_rate) / 100))

    offer.amount = primary_amount
    offer.base_amount = primary_amount
    offer.vat_amount = vat_amount
    offer.total_amount = money(primary_amount + vat_amount)

    db.commit()
    db.refresh(offer)

    return offer


def get_offer_or_404(db: Session, offer_id: int) -> Offer:
    offer = offer_repository.get_offer(db=db, offer_id=offer_id)

    if offer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teklif bulunamadı.",
        )

    return offer


def list_offers(
    db: Session,
    search: str | None = None,
    customer_id: int | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
):
    return offer_repository.list_offers(
        db=db,
        search=search,
        customer_id=customer_id,
        status=status,
        skip=skip,
        limit=limit,
    )


def create_offer(db: Session, payload: OfferCreate):
    _validate_choice("invoice_type", payload.invoice_type, constants.INVOICE_TYPES)
    _validate_choice("currency", payload.currency, constants.CURRENCIES)
    _validate_choice(
        "advance_payment_currency",
        payload.advance_payment_currency,
        constants.CURRENCIES,
    )

    _validate_offer_refs(
        db=db,
        customer_id=payload.customer_id,
        venue_id=payload.venue_id,
        package_id=payload.package_id,
    )

    data = payload.model_dump()
    data["offer_no"] = _next_offer_no(db=db)
    data["status"] = "draft"

    if data.get("offer_date") is None:
        data["offer_date"] = date.today()

    offer = offer_repository.create_offer(db=db, data=data)
    return _recalculate_offer(db=db, offer=offer)


def update_offer(db: Session, offer_id: int, payload: OfferUpdate):
    offer = get_offer_or_404(db=db, offer_id=offer_id)

    if offer.status == "agreement":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Anlaşmaya çevrilmiş teklif doğrudan düzenlenemez. Revizyon / ek protokol akışı kullanılmalıdır.",
        )

    data = payload.model_dump(exclude_unset=True)

    _validate_choice("status", data.get("status"), constants.OFFER_STATUSES)
    _validate_choice("invoice_type", data.get("invoice_type"), constants.INVOICE_TYPES)
    _validate_choice("currency", data.get("currency"), constants.CURRENCIES)
    _validate_choice(
        "advance_payment_currency",
        data.get("advance_payment_currency"),
        constants.CURRENCIES,
    )

    customer_id = data.get("customer_id", offer.customer_id)
    venue_id = data.get("venue_id", offer.venue_id)
    package_id = data.get("package_id", offer.package_id)

    _validate_offer_refs(
        db=db,
        customer_id=customer_id,
        venue_id=venue_id,
        package_id=package_id,
    )

    updated = offer_repository.update_offer(db=db, offer=offer, data=data)
    return _recalculate_offer(db=db, offer=updated)


def _to_internal_item_read(item: OfferItem) -> OfferInternalItemRead:
    revenue = _dec(item.base_amount)
    cost = _dec(item.internal_total_cost)

    internal_profit = 0

    if item.currency == item.internal_cost_currency:
        internal_profit = money(revenue - cost)

    return OfferInternalItemRead(
        id=item.id,
        offer_id=item.offer_id,
        source_type=item.source_type,
        source_package_item_id=item.source_package_item_id,
        artist_id=item.artist_id,
        service_item_id=item.service_item_id,
        title=item.title,
        description=item.description,
        program_section=item.program_section,
        start_time=item.start_time,
        end_time=item.end_time,
        quantity=_dec(item.quantity),
        unit_price=_dec(item.unit_price),
        currency=item.currency,
        base_amount=revenue,
        is_visible_on_offer=item.is_visible_on_offer,
        is_active=item.is_active,
        sort_order=item.sort_order,
        internal_unit_cost=_dec(item.internal_unit_cost),
        internal_cost_currency=item.internal_cost_currency,
        internal_total_cost=cost,
        internal_profit=internal_profit,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _visible_summaries(offer: Offer, items: list[OfferItem]) -> list[OfferSummary]:
    totals: dict[str, float] = defaultdict(lambda: D(0))

    for item in items:
        if item.is_visible_on_offer:
            totals[item.currency] += _dec(item.base_amount)

    summaries = []

    for currency, amount in sorted(totals.items()):
        vat_amount = 0

        if offer.invoice_type == "with_invoice" and currency == offer.currency:
            vat_amount = money(amount * (_dec(offer.vat_rate) / 100))

        summaries.append(
            OfferSummary(
                currency=currency,
                visible_amount=money(amount),
                vat_amount=vat_amount,
                total_amount=money(amount + vat_amount),
            )
        )

    return summaries


def _internal_summaries(items: list[OfferItem]) -> list[OfferInternalSummary]:
    totals: dict[str, dict[str, float]] = defaultdict(
        lambda: {"revenue": D(0), "cost": D(0)}
    )

    for item in items:
        if item.currency == item.internal_cost_currency:
            totals[item.currency]["revenue"] += _dec(item.base_amount)
            totals[item.currency]["cost"] += _dec(item.internal_total_cost)
        else:
            totals[item.currency]["revenue"] += _dec(item.base_amount)
            totals[item.internal_cost_currency]["cost"] += _dec(
                item.internal_total_cost
            )

    summaries = []

    for currency, values in sorted(totals.items()):
        revenue = money(values["revenue"])
        cost = money(values["cost"])

        summaries.append(
            OfferInternalSummary(
                currency=currency,
                revenue_amount=revenue,
                cost_amount=cost,
                gross_profit_amount=money(revenue - cost),
            )
        )

    return summaries


def get_offer_detail(db: Session, offer_id: int) -> OfferDetail:
    offer = get_offer_or_404(db=db, offer_id=offer_id)
    items = offer_repository.list_offer_items(db=db, offer_id=offer_id)

    return OfferDetail(
        offer=OfferRead.model_validate(offer),
        items=[_to_internal_item_read(item) for item in items],
        visible_summaries=_visible_summaries(offer=offer, items=items),
        internal_summaries=_internal_summaries(items=items),
    )


def create_offer_item(db: Session, offer_id: int, payload: OfferItemCreate):
    offer = get_offer_or_404(db=db, offer_id=offer_id)

    if offer.status == "agreement":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Anlaşmaya çevrilmiş teklife bu ekrandan kalem eklenemez.",
        )

    if offer.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="İptal edilmiş teklife kalem eklenemez.",
        )

    _validate_choice("currency", payload.currency, constants.CURRENCIES)
    _validate_choice(
        "internal_cost_currency",
        payload.internal_cost_currency,
        constants.CURRENCIES,
    )

    source_type = payload.source_type or "manual"

    if source_type not in ["manual", "artist", "technical_service"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz teklif kalemi kaynağı.",
        )

    data = payload.model_dump()
    data["offer_id"] = offer.id
    data["source_type"] = source_type
    data["source_package_item_id"] = None

    if source_type == "artist":
        if not payload.artist_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sanatçı seçilmeden sanatçı kalemi eklenemez.",
            )

        artist = db.get(Artist, payload.artist_id)

        if artist is None or not artist.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sanatçı bulunamadı veya pasif durumda.",
            )

        data["artist_id"] = artist.id
        data["service_item_id"] = None

    elif source_type == "technical_service":
        if not payload.service_item_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Teknik hizmet seçilmeden teknik hizmet kalemi eklenemez.",
            )

        service_item = db.get(ServiceItem, payload.service_item_id)

        if service_item is None or not service_item.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Teknik hizmet bulunamadı veya pasif durumda.",
            )

        data["artist_id"] = None
        data["service_item_id"] = service_item.id

    else:
        data["artist_id"] = None
        data["service_item_id"] = None

    data["base_amount"] = _line_amount(payload.quantity, payload.unit_price)
    data["internal_total_cost"] = _line_amount(
        payload.quantity,
        payload.internal_unit_cost,
    )

    item = offer_repository.create_offer_item(db=db, data=data)
    _recalculate_offer(db=db, offer=offer)

    return _to_internal_item_read(item)


def import_package_to_offer(
    db: Session,
    offer_id: int,
    payload: ImportPackageRequest,
) -> OfferDetail:
    offer = get_offer_or_404(db=db, offer_id=offer_id)
    package = db.get(ServicePackage, payload.package_id)

    if package is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Program paketi bulunamadı.",
        )

    if payload.clear_existing_items:
        offer_repository.deactivate_offer_items(db=db, offer_id=offer.id)

    package_items = (
        db.query(ServicePackageItem)
        .filter(
            ServicePackageItem.package_id == package.id,
            ServicePackageItem.is_active == True,  # noqa: E712
        )
        .order_by(ServicePackageItem.sort_order.asc(), ServicePackageItem.id.asc())
        .all()
    )

    package_sale_amount = _dec(package.default_sale_amount)
    package_sale_currency = package.default_sale_currency or offer.currency or "TRY"

    if package_sale_amount <= 0:
        package_sale_amount = money(
            sum(
                _dec(package_item.total_sale_amount)
                for package_item in package_items
                if package_item.is_visible_on_offer
                and package_item.unit_sale_currency == package_sale_currency
            )
        )

    package_total_item = {
        "offer_id": offer.id,
        "source_type": "package_total",
        "source_package_item_id": None,
        "artist_id": None,
        "service_item_id": None,
        "title": package.name,
        "description": package.description or "Kombine paket bedeli",
        "program_section": "other",
        "start_time": None,
        "end_time": None,
        "quantity": 1,
        "unit_price": package_sale_amount,
        "currency": package_sale_currency,
        "base_amount": package_sale_amount,
        "internal_unit_cost": 0,
        "internal_cost_currency": package_sale_currency,
        "internal_total_cost": 0,
        "is_visible_on_offer": True,
        "is_active": True,
        "sort_order": -1000,
    }

    offer_repository.create_offer_item(db=db, data=package_total_item)

    for package_item in package_items:
        data = {
            "offer_id": offer.id,
            "source_type": "package_component",
            "source_package_item_id": package_item.id,
            "artist_id": package_item.artist_id,
            "service_item_id": package_item.service_item_id,
            "title": package_item.title,
            "description": package_item.notes or package_item.title,
            "program_section": package_item.program_section,
            "start_time": package_item.start_time,
            "end_time": package_item.end_time,
            "quantity": package_item.quantity,
            "unit_price": 0,
            "currency": package_sale_currency,
            "base_amount": 0,
            "internal_unit_cost": package_item.unit_cost_amount,
            "internal_cost_currency": package_item.unit_cost_currency,
            "internal_total_cost": package_item.total_cost_amount,
            "is_visible_on_offer": package_item.is_visible_on_offer,
            "is_active": True,
            "sort_order": package_item.sort_order,
        }

        offer_repository.create_offer_item(db=db, data=data)

    offer.package_id = package.id
    offer.currency = package_sale_currency
    offer.advance_payment_currency = package_sale_currency

    db.commit()

    _recalculate_offer(db=db, offer=offer)

    return get_offer_detail(db=db, offer_id=offer.id)


def deactivate_offer_item(db: Session, offer_id: int, item_id: int):
    offer = get_offer_or_404(db=db, offer_id=offer_id)
    item = offer_repository.get_offer_item(
        db=db,
        offer_id=offer_id,
        item_id=item_id,
    )

    if item is None or not item.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teklif kalemi bulunamadı.",
        )

    deactivated = offer_repository.deactivate_offer_item(db=db, item=item)
    _recalculate_offer(db=db, offer=offer)

    return _to_internal_item_read(deactivated)


def _event_code_from_offer(offer: Offer) -> str:
    if offer.offer_no:
        return f"EVT-{offer.offer_no}"

    return f"EVT-OFFER-{offer.id:05d}"


def _create_event_from_offer_if_needed(db: Session, offer: Offer) -> Event:
    if offer.event_id:
        existing_event = db.get(Event, offer.event_id)

        if existing_event:
            return existing_event

    event = Event(
        event_code=_event_code_from_offer(offer=offer),
        title=offer.title,
        customer_id=offer.customer_id,
        venue_id=offer.venue_id,
        responsible_partner_id=None,
        operation_user_id=None,
        event_date=offer.event_date or date.today(),
        start_datetime=None,
        end_datetime=None,
        status="planned",
        invoice_type=offer.invoice_type,
        vat_rate=offer.vat_rate,
        agreement_amount=offer.amount,
        agreement_currency=offer.currency,
        exchange_rate=offer.exchange_rate,
        base_agreement_amount=offer.base_amount,
        vat_amount=offer.vat_amount,
        total_customer_amount=offer.total_amount,
        notes=offer.customer_visible_notes,
        is_period_closed=False,
    )

    db.add(event)
    db.flush()

    offer_items = offer_repository.list_offer_items(db=db, offer_id=offer.id)

    for offer_item in offer_items:
        event_item = EventItem(
            event_id=event.id,
            item_type=offer_item.source_type,
            artist_id=offer_item.artist_id,
            service_item_id=offer_item.service_item_id,
            description=f"{offer_item.title}\n{offer_item.description}",
            sale_amount=offer_item.base_amount,
            sale_currency=offer_item.currency,
            cost_amount=offer_item.internal_total_cost,
            cost_currency=offer_item.internal_cost_currency,
            exchange_rate=1,
            base_sale_amount=offer_item.base_amount,
            base_cost_amount=offer_item.internal_total_cost,
            sort_order=offer_item.sort_order,
        )

        db.add(event_item)

    offer.event_id = event.id

    db.commit()
    db.refresh(event)
    db.refresh(offer)

    return event


def convert_to_agreement(
    db: Session,
    offer_id: int,
    payload: ConvertAgreementRequest,
):
    offer = get_offer_or_404(db=db, offer_id=offer_id)
    event = _create_event_from_offer_if_needed(db=db, offer=offer)

    offer.status = "agreement"
    offer.event_id = event.id
    offer.agreement_notes = payload.agreement_notes

    db.commit()
    db.refresh(offer)

    return offer


def cancel_offer(db: Session, offer_id: int):
    offer = get_offer_or_404(db=db, offer_id=offer_id)

    if offer.status == "agreement":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Anlaşmaya çevrilmiş teklif bu ekrandan iptal edilemez. Önce etkinlik / anlaşma iptal süreci kullanılmalıdır.",
        )

    if offer.status == "cancelled":
        return offer

    offer.status = "cancelled"

    db.commit()
    db.refresh(offer)

    return offer


def get_print_view(db: Session, offer_id: int) -> OfferPrintView:
    offer = get_offer_or_404(db=db, offer_id=offer_id)
    customer = db.get(Customer, offer.customer_id)
    venue = db.get(Venue, offer.venue_id) if offer.venue_id else None
    items = offer_repository.list_offer_items(db=db, offer_id=offer_id)

    visible_items = [item for item in items if item.is_visible_on_offer]

    return OfferPrintView(
        offer_id=offer.id,
        offer_no=offer.offer_no,
        title=offer.title,
        customer_name=customer.name if customer else "-",
        venue_name=venue.name if venue else None,
        event_date=offer.event_date,
        valid_until=offer.valid_until,
        invoice_type=offer.invoice_type,
        vat_rate=_dec(offer.vat_rate),
        customer_visible_notes=offer.customer_visible_notes,
        payment_terms=offer.payment_terms,
        advance_payment_amount=_dec(offer.advance_payment_amount),
        advance_payment_currency=offer.advance_payment_currency,
        lines=[
            OfferPrintLine(
                sort_order=item.sort_order,
                title=item.title,
                description=item.description,
                program_section=item.program_section,
                start_time=item.start_time,
                end_time=item.end_time,
                quantity=_dec(item.quantity),
                unit_price=_dec(item.unit_price),
                currency=item.currency,
                line_amount=_dec(item.base_amount),
                show_pricing=item.source_type != "package_component",
            )
            for item in visible_items
        ],
        summaries=_visible_summaries(offer=offer, items=visible_items),
    )