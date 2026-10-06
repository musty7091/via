from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.deps import RequestContext
from app.core.errors import DomainError, NotFoundError
from app.core.money import BASE_CURRENCY, ZERO, Currency, money, vat_amount
from app.core.permissions import Permission, permissions_for
from app.core.schemas import columns
from app.core.sequences import next_number
from app.core.text import fold, search_pattern
from app.modules.audit import service as audit
from app.modules.catalog.models import Artist, Package, ProgramSection, ServiceItem
from app.modules.customers.models import (
    Customer,
    CustomerContact,
    InvoicePreference,
    RiskLevel,
    Venue,
)
from app.modules.events.models import Event, EventItem
from app.modules.finance import agreements as finance_agreements
from app.modules.offers.models import LineType, Offer, OfferLine, OfferStatus
from app.modules.offers.schemas import (
    CompanyInfo,
    OfferCreate,
    OfferDetail,
    OfferLineCreate,
    OfferLineRead,
    OfferLineUpdate,
    OfferListItem,
    OfferPrint,
    OfferUpdate,
    PackageImport,
    PrintLine,
    Profitability,
    Ref,
)
from app.modules.operations import service as operations
from app.modules.partners.models import Partner
from app.modules.settings.router import get_company_settings
from app.modules.users.models import User

STATUS_LABELS = {
    OfferStatus.DRAFT: "Taslak",
    OfferStatus.SENT: "Gönderildi",
    OfferStatus.ACCEPTED: "Kabul edildi",
    OfferStatus.REJECTED: "Reddedildi",
    OfferStatus.CANCELLED: "İptal",
    OfferStatus.CONVERTED: "Anlaşmaya çevrildi",
}

# eylem: (izin verilen mevcut durumlar, yeni durum)
TRANSITIONS: dict[str, tuple[set[OfferStatus], OfferStatus]] = {
    "send": ({OfferStatus.DRAFT}, OfferStatus.SENT),
    "accept": ({OfferStatus.SENT}, OfferStatus.ACCEPTED),
    "reject": ({OfferStatus.SENT, OfferStatus.ACCEPTED}, OfferStatus.REJECTED),
    "cancel": (
        {OfferStatus.DRAFT, OfferStatus.SENT, OfferStatus.ACCEPTED, OfferStatus.REJECTED},
        OfferStatus.CANCELLED,
    ),
    "reopen": ({OfferStatus.SENT, OfferStatus.ACCEPTED, OfferStatus.REJECTED}, OfferStatus.DRAFT),
}
CONVERTIBLE = {OfferStatus.SENT, OfferStatus.ACCEPTED}

OFFER_AUDIT_FIELDS = [
    "customer_id",
    "contact_id",
    "venue_id",
    "partner_id",
    "title",
    "event_date",
    "event_start",
    "event_end",
    "guest_count",
    "valid_until",
    "invoice_type",
    "vat_rate",
    "currency",
    "exchange_rate",
    "discount_amount",
    "advance_amount",
    "payment_terms",
    "customer_notes",
    "internal_notes",
]
LINE_AUDIT_FIELDS = [
    "line_type",
    "title",
    "quantity",
    "unit_price",
    "unit_cost",
    "cost_currency",
    "cost_rate",
    "is_visible",
    "start_time",
    "end_time",
]


def _can(user: User, permission: Permission) -> bool:
    return permission in permissions_for(user.role)


# --- Doğrulamalar ---


def _customer(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise DomainError("Müşteri bulunamadı.")
    if not customer.is_active:
        raise DomainError(f"{customer.name} pasif durumda; teklif verilemez.")
    if customer.risk_level == RiskLevel.BLOCKED:
        raise DomainError(f"{customer.name} engelli müşteri; teklif verilemez.")
    return customer


def _contact(db: Session, contact_id: int | None, customer_id: int) -> int | None:
    if contact_id is None:
        return None
    contact = db.get(CustomerContact, contact_id)
    if contact is None or contact.customer_id != customer_id:
        raise DomainError("Seçilen yetkili bu müşteriye ait değil.")
    return contact_id


def _venue(db: Session, venue_id: int | None) -> int | None:
    if venue_id is None:
        return None
    venue = db.get(Venue, venue_id)
    if venue is None or not venue.is_active:
        raise DomainError("Seçilen mekân bulunamadı veya pasif.")
    return venue_id


def _partner(db: Session, partner_id: int | None, user: User) -> int:
    if partner_id is None:
        partner_id = db.scalar(select(Partner.id).where(Partner.user_id == user.id))
        if partner_id is None:
            raise DomainError("İşi getiren ortağı seçin.")
    partner = db.get(Partner, partner_id)
    if partner is None or not partner.is_active:
        raise DomainError("Seçilen ortak bulunamadı veya pasif.")
    return partner_id


def _offer_rate(currency: Currency, rate: Decimal | None) -> Decimal:
    if currency == BASE_CURRENCY:
        return Decimal("1")
    if rate is None:
        raise DomainError(f"{currency} teklif için TL kuru girilmelidir.")
    return rate


def _cost_rate(offer: Offer, cost_currency: Currency, given: Decimal | None) -> Decimal:
    if cost_currency == BASE_CURRENCY:
        return Decimal("1")
    if given is not None:
        return given
    if cost_currency == offer.currency:
        return offer.exchange_rate
    raise DomainError(f"{cost_currency} maliyet için TL kuru girilmelidir.")


def _ensure_editable(offer: Offer) -> None:
    if offer.status != OfferStatus.DRAFT:
        raise DomainError(
            f"Teklif '{STATUS_LABELS[offer.status]}' durumunda; "
            "sadece taslak teklif düzenlenebilir."
        )


def _check_hidden_price(is_visible: bool, unit_price: Decimal) -> None:
    if not is_visible and unit_price > 0:
        raise DomainError("Müşteriye gösterilmeyen satırın satış fiyatı olamaz.")


# --- Hesaplama ---


def line_total(line: OfferLine | EventItem) -> Decimal:
    return money(line.quantity * line.unit_price)


def cost_total_base(line: OfferLine | EventItem) -> Decimal:
    return money(line.quantity * line.unit_cost * line.cost_rate)


def recalculate(offer: Offer) -> None:
    subtotal = sum(
        (line_total(line) for line in offer.lines if line.line_type != LineType.PACKAGE_COMPONENT),
        ZERO,
    )
    offer.subtotal = money(subtotal)
    offer.net_amount = money(subtotal - offer.discount_amount)
    offer.vat_amount = (
        vat_amount(offer.net_amount, offer.vat_rate)
        if offer.invoice_type == InvoicePreference.WITH_INVOICE
        else ZERO
    )
    offer.total_amount = money(offer.net_amount + offer.vat_amount)


def profitability(
    lines: list[OfferLine] | list[EventItem], net_amount: Decimal, rate: Decimal
) -> Profitability:
    revenue = money(net_amount * rate)
    cost = sum((cost_total_base(line) for line in lines), ZERO)
    warnings = [
        f"{line.title} için maliyet girilmemiş."
        for line in lines
        if line.artist_id or line.service_id
        if line.unit_cost == 0
    ]
    profit = money(revenue - cost)
    margin = (profit / revenue * 100).quantize(Decimal("0.1")) if revenue > 0 else None
    return Profitability(
        revenue_base=revenue,
        cost_base=money(cost),
        profit_base=profit,
        margin_percent=margin,
        warnings=warnings,
    )


def _validate_amounts(offer: Offer, *, strict: bool = False) -> None:
    """İndirim ve ön ödeme toplamı aşamaz. Henüz fiyatlı satır yokken (teklif yeni
    açılırken) kontrol, gönderme/anlaşma anına (strict) bırakılır."""
    if offer.subtotal == 0 and not strict:
        return
    if offer.discount_amount > offer.subtotal:
        raise DomainError("İndirim, ara toplamdan büyük olamaz.")
    if offer.advance_amount > offer.total_amount:
        raise DomainError("Ön ödeme, genel toplamdan büyük olamaz.")


def _validate_ready(offer: Offer) -> None:
    """Teklif müşteriye gönderilmeden / anlaşmaya çevrilmeden önceki kontroller."""
    if offer.total_amount <= 0:
        raise DomainError("Teklifte fiyatlı en az bir satır olmalıdır.")
    _validate_amounts(offer, strict=True)
    if offer.valid_until < offer.offer_date:
        raise DomainError("Geçerlilik tarihi teklif tarihinden önce olamaz.")


def _refresh_search(offer: Offer) -> None:
    offer.search_text = fold(offer.offer_no, offer.title, offer.customer.name)


# --- Okuma ---


def is_expired(offer: Offer) -> bool:
    return (
        offer.status in {OfferStatus.DRAFT, OfferStatus.SENT} and offer.valid_until < clock.today()
    )


def _event_id(db: Session, offer_id: int) -> int | None:
    return db.scalar(select(Event.id).where(Event.offer_id == offer_id))


def get_offer(db: Session, offer_id: int) -> Offer:
    offer = db.get(Offer, offer_id)
    if offer is None:
        raise NotFoundError("Teklif bulunamadı.")
    return offer


def list_offers(
    db: Session,
    *,
    search: str | None,
    status: OfferStatus | None,
    customer_id: int | None,
    offset: int,
    limit: int,
) -> tuple[list[OfferListItem], int]:
    query = select(Offer)
    if search:
        query = query.where(Offer.search_text.like(search_pattern(search)))
    if status:
        query = query.where(Offer.status == status)
    else:
        query = query.where(Offer.status != OfferStatus.CANCELLED)
    if customer_id is not None:
        query = query.where(Offer.customer_id == customer_id)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    offers = db.scalars(query.order_by(Offer.id.desc()).offset(offset).limit(limit)).all()
    events = dict(
        db.execute(
            select(Event.offer_id, Event.id).where(Event.offer_id.in_([o.id for o in offers]))
        ).all()
    )
    items = [
        OfferListItem(
            id=o.id,
            offer_no=o.offer_no,
            status=o.status,
            is_expired=is_expired(o),
            title=o.title,
            customer=Ref(id=o.customer.id, name=o.customer.name),
            partner=Ref(id=o.partner.id, name=o.partner.full_name),
            event_date=o.event_date,
            offer_date=o.offer_date,
            valid_until=o.valid_until,
            currency=o.currency,
            total_amount=o.total_amount,
            event_id=events.get(o.id),
        )
        for o in offers
    ]
    return items, total


def line_read(line: OfferLine | EventItem, show_costs: bool) -> OfferLineRead:
    data = columns(line)
    data["line_total"] = line_total(line)
    if show_costs:
        data["cost_total_base"] = cost_total_base(line)
    else:
        for key in ("unit_cost", "cost_currency", "cost_rate"):
            data[key] = None
        data["cost_total_base"] = None
    return OfferLineRead.model_validate(data)


def _allowed_actions(offer: Offer, user: User) -> list[str]:
    if not _can(user, Permission.OFFERS_MANAGE):
        return []
    actions = [name for name, (sources, _) in TRANSITIONS.items() if offer.status in sources]
    if offer.status == OfferStatus.DRAFT:
        actions.append("edit")
    if offer.status in CONVERTIBLE and _can(user, Permission.EVENTS_MANAGE):
        actions.append("convert")
    actions.append("duplicate")
    return actions


def offer_detail(db: Session, offer: Offer, user: User) -> OfferDetail:
    show_costs = _can(user, Permission.COSTS_VIEW)
    return OfferDetail(
        **{k: v for k, v in columns(offer).items() if k in OfferDetail.model_fields},
        is_expired=is_expired(offer),
        customer=Ref(id=offer.customer.id, name=offer.customer.name),
        customer_risk_level=offer.customer.risk_level,
        contact=Ref(id=offer.contact.id, name=offer.contact.full_name) if offer.contact else None,
        venue=Ref(id=offer.venue.id, name=offer.venue.name) if offer.venue else None,
        partner=Ref(id=offer.partner.id, name=offer.partner.full_name),
        remaining_amount=money(offer.total_amount - offer.advance_amount),
        base_total_amount=money(offer.total_amount * offer.exchange_rate),
        created_by_name=offer.created_by.full_name if offer.created_by else None,
        event_id=_event_id(db, offer.id),
        lines=[line_read(line, show_costs) for line in offer.lines],
        profitability=profitability(offer.lines, offer.net_amount, offer.exchange_rate)
        if show_costs
        else None,
        allowed_actions=_allowed_actions(offer, user),
    )


# --- Teklif yazma ---


def create_offer(db: Session, data: OfferCreate, *, actor: User, context: RequestContext) -> Offer:
    settings = get_company_settings(db)
    customer = _customer(db, data.customer_id)
    today = clock.today()
    currency = data.currency or Currency(customer.default_currency)

    offer = Offer(
        offer_no=next_number(db, "offer", today.year, "VIA-T"),
        status=OfferStatus.DRAFT,
        customer_id=customer.id,
        contact_id=_contact(db, data.contact_id, customer.id),
        venue_id=_venue(db, data.venue_id),
        partner_id=_partner(db, data.partner_id, actor),
        title=data.title.strip(),
        event_date=data.event_date,
        event_start=data.event_start,
        event_end=data.event_end,
        guest_count=data.guest_count,
        offer_date=today,
        valid_until=data.valid_until or today + timedelta(days=settings.offer_validity_days),
        invoice_type=data.invoice_type
        or customer.default_invoice
        or InvoicePreference.WITHOUT_INVOICE,
        vat_rate=data.vat_rate if data.vat_rate is not None else settings.default_vat_rate,
        currency=currency,
        exchange_rate=_offer_rate(currency, data.exchange_rate),
        discount_amount=data.discount_amount,
        advance_amount=data.advance_amount,
        payment_terms=data.payment_terms or settings.default_payment_terms,
        customer_notes=data.customer_notes,
        internal_notes=data.internal_notes,
        created_by_id=actor.id,
        lines=[],
    )
    offer.customer = customer
    if offer.valid_until < today:
        raise DomainError("Geçerlilik tarihi bugünden önce olamaz.")
    db.add(offer)
    db.flush()
    if data.package_id is not None:
        _import_package(db, offer, PackageImport(package_id=data.package_id))
    recalculate(offer)
    _validate_amounts(offer)
    _refresh_search(offer)
    audit.record(
        db,
        actor=actor,
        action="offer.create",
        entity_type="offer",
        entity_id=offer.id,
        summary=f"{offer.offer_no} teklifi oluşturuldu: {offer.title} ({customer.name}).",
        changes=audit.snapshot(offer, OFFER_AUDIT_FIELDS),
        context=context,
    )
    db.commit()
    db.refresh(offer)
    return offer


def update_offer(
    db: Session, offer: Offer, data: OfferUpdate, *, actor: User, context: RequestContext
) -> Offer:
    _ensure_editable(offer)
    changes: dict[str, Any] = data.model_dump(exclude_unset=True)
    required = {
        "customer_id",
        "partner_id",
        "title",
        "valid_until",
        "invoice_type",
        "vat_rate",
        "currency",
        "discount_amount",
        "advance_amount",
    }
    changes = {k: v for k, v in changes.items() if v is not None or k not in required}
    if not changes:
        return offer

    if "customer_id" in changes and changes["customer_id"] != offer.customer_id:
        offer.customer = _customer(db, changes["customer_id"])
        if "contact_id" not in changes:
            changes["contact_id"] = None
    customer_id = changes.get("customer_id", offer.customer_id)
    if "contact_id" in changes:
        changes["contact_id"] = _contact(db, changes["contact_id"], customer_id)
    if "venue_id" in changes:
        changes["venue_id"] = _venue(db, changes["venue_id"])
    if "partner_id" in changes:
        changes["partner_id"] = _partner(db, changes["partner_id"], actor)
    if "title" in changes:
        changes["title"] = changes["title"].strip()

    currency = Currency(changes.get("currency", offer.currency))
    if currency != offer.currency and offer.lines:
        raise DomainError(
            "Satır eklendikten sonra para birimi değiştirilemez. "
            "Satırları silin veya teklifi farklı para birimiyle yeniden oluşturun."
        )
    if "currency" in changes or "exchange_rate" in changes:
        if "exchange_rate" in changes:
            given_rate = changes["exchange_rate"]
        elif currency == offer.currency:
            given_rate = offer.exchange_rate
        else:
            # Para birimi değişti ama kur girilmedi: eski kur yeni para birimine taşınmaz.
            given_rate = None
        changes["exchange_rate"] = _offer_rate(currency, given_rate)

    start = changes.get("event_start", offer.event_start)
    end = changes.get("event_end", offer.event_end)
    if (start is None) != (end is None):
        raise DomainError("Başlangıç ve bitiş saati birlikte girilmelidir.")

    diff = audit.apply_changes(offer, changes, OFFER_AUDIT_FIELDS)
    if "exchange_rate" in diff:
        # Teklif para birimindeki maliyetler teklif kurunu izler.
        for line in offer.lines:
            if line.cost_currency == offer.currency and line.cost_currency != BASE_CURRENCY:
                line.cost_rate = offer.exchange_rate
    if offer.valid_until < offer.offer_date:
        raise DomainError("Geçerlilik tarihi teklif tarihinden önce olamaz.")
    recalculate(offer)
    _validate_amounts(offer)
    _refresh_search(offer)
    audit.record(
        db,
        actor=actor,
        action="offer.update",
        entity_type="offer",
        entity_id=offer.id,
        summary=f"{offer.offer_no} teklifi güncellendi.",
        changes=diff,
        context=context,
    )
    db.commit()
    db.refresh(offer)
    return offer


def change_status(
    db: Session,
    offer: Offer,
    action: str,
    note: str | None,
    *,
    actor: User,
    context: RequestContext,
) -> Offer:
    sources, target = TRANSITIONS[action]
    if offer.status not in sources:
        raise DomainError(
            f"'{STATUS_LABELS[offer.status]}' durumundaki teklif için bu işlem yapılamaz."
        )
    if action in {"reject", "cancel"} and not note:
        raise DomainError("Lütfen sebep yazın.")
    if action == "send":
        _customer(db, offer.customer_id)
        recalculate(offer)
        _validate_ready(offer)
        if offer.valid_until < clock.today():
            raise DomainError("Geçerlilik tarihi geçmiş teklif gönderilemez; tarihi güncelleyin.")
        offer.sent_at = clock.now()
    if action in {"accept", "reject"}:
        offer.decided_at = clock.now()
    if action == "reopen":
        offer.decided_at = None
    previous = offer.status
    offer.status = target
    offer.status_note = note if action in {"reject", "cancel"} else offer.status_note
    audit.record(
        db,
        actor=actor,
        action=f"offer.{action}",
        entity_type="offer",
        entity_id=offer.id,
        summary=(
            f"{offer.offer_no} teklifi: {STATUS_LABELS[previous]} → {STATUS_LABELS[target]}."
            + (f" Sebep: {note}" if note else "")
        ),
        changes={"status": {"before": str(previous), "after": str(target)}},
        context=context,
    )
    db.commit()
    db.refresh(offer)
    return offer


def duplicate_offer(db: Session, source: Offer, *, actor: User, context: RequestContext) -> Offer:
    customer = _customer(db, source.customer_id)
    settings = get_company_settings(db)
    today = clock.today()
    offer = Offer(
        **{
            field: getattr(source, field)
            for field in OFFER_AUDIT_FIELDS
            if field not in {"valid_until"}
        },
        offer_no=next_number(db, "offer", today.year, "VIA-T"),
        status=OfferStatus.DRAFT,
        offer_date=today,
        valid_until=today + timedelta(days=settings.offer_validity_days),
        created_by_id=actor.id,
        lines=[],
    )
    offer.customer = customer
    db.add(offer)
    db.flush()
    _copy_lines(source.lines, offer.lines, OfferLine)
    db.flush()
    recalculate(offer)
    _refresh_search(offer)
    audit.record(
        db,
        actor=actor,
        action="offer.duplicate",
        entity_type="offer",
        entity_id=offer.id,
        summary=f"{offer.offer_no} teklifi {source.offer_no} kopyalanarak oluşturuldu.",
        context=context,
    )
    db.commit()
    db.refresh(offer)
    return offer


_LINE_COPY_FIELDS = [
    "line_type",
    "package_id",
    "artist_id",
    "service_id",
    "title",
    "description",
    "program_section",
    "start_time",
    "end_time",
    "quantity",
    "unit_price",
    "unit_cost",
    "cost_currency",
    "cost_rate",
    "is_visible",
    "sort_order",
]


def _copy_lines(source: list, target: list, model: type) -> None:
    """Satırları kopyalar; paket içeriği yeni paket başlığına bağlanır."""
    new_by_old: dict[int, Any] = {}
    for line in source:
        if line.parent_id is None:
            copy = model(**{f: getattr(line, f) for f in _LINE_COPY_FIELDS})
            target.append(copy)
            new_by_old[line.id] = copy
    for line in source:
        if line.parent_id is not None:
            copy = model(**{f: getattr(line, f) for f in _LINE_COPY_FIELDS})
            copy.parent = new_by_old[line.parent_id]  # type: ignore[attr-defined]
            target.append(copy)


# --- Satırlar ---


def _next_sort(offer: Offer) -> int:
    return max((line.sort_order for line in offer.lines), default=0) + 10


def get_line(offer: Offer, line_id: int) -> OfferLine:
    for line in offer.lines:
        if line.id == line_id:
            return line
    raise NotFoundError("Teklif satırı bulunamadı.")


def _finish_line_change(
    db: Session,
    offer: Offer,
    *,
    actor: User,
    context: RequestContext,
    action: str,
    summary: str,
    changes: dict[str, Any] | None,
) -> Offer:
    db.flush()
    db.refresh(offer)
    # Satır eklerken tutar kontrolü yapılmaz (satırlar tek tek eklenir);
    # gönderme ve anlaşma anında kesin kontrol yapılır.
    recalculate(offer)
    audit.record(
        db,
        actor=actor,
        action=action,
        entity_type="offer",
        entity_id=offer.id,
        summary=summary,
        changes=changes,
        context=context,
    )
    db.commit()
    db.refresh(offer)
    return offer


def add_line(
    db: Session, offer: Offer, data: OfferLineCreate, *, actor: User, context: RequestContext
) -> Offer:
    _ensure_editable(offer)
    source: Artist | ServiceItem | None = None
    if data.line_type == LineType.ARTIST:
        source = db.get(Artist, data.artist_id)
        section = ProgramSection.MAIN
    elif data.line_type == LineType.SERVICE:
        source = db.get(ServiceItem, data.service_id)
        section = ProgramSection.TECHNICAL
    else:
        section = ProgramSection.OTHER
    if data.line_type != LineType.CUSTOM:
        if source is None:
            raise DomainError("Seçilen kayıt bulunamadı.")
        if not source.is_active:
            raise DomainError(f"{source.name} pasif durumda; teklife eklenemez.")

    unit_price = data.unit_price
    if unit_price is None:
        same_currency = source is not None and source.price_currency == offer.currency
        unit_price = (source.default_price or ZERO) if same_currency else ZERO  # type: ignore[union-attr]
    unit_cost = data.unit_cost
    if unit_cost is None:
        unit_cost = (source.default_cost or ZERO) if source else ZERO
    cost_currency = data.cost_currency or (
        Currency(source.cost_currency) if source else Currency(offer.currency)
    )
    _check_hidden_price(data.is_visible, unit_price)

    line = OfferLine(
        line_type=data.line_type,
        artist_id=data.artist_id,
        service_id=data.service_id,
        title=(data.title or "").strip() or (source.name if source else ""),
        description=data.description,
        program_section=data.program_section or section,
        start_time=data.start_time,
        end_time=data.end_time,
        quantity=data.quantity,
        unit_price=unit_price,
        unit_cost=unit_cost,
        cost_currency=cost_currency,
        cost_rate=_cost_rate(offer, cost_currency, data.cost_rate),
        is_visible=data.is_visible,
        sort_order=_next_sort(offer),
    )
    offer.lines.append(line)
    return _finish_line_change(
        db,
        offer,
        actor=actor,
        context=context,
        action="offer.line_add",
        summary=f"{offer.offer_no} teklifine satır eklendi: {line.title}.",
        changes=audit.snapshot(line, LINE_AUDIT_FIELDS),
    )


def _import_package(
    db: Session, offer: Offer, data: PackageImport, cost_rates: dict | None = None
) -> OfferLine:
    package = db.get(Package, data.package_id)
    if package is None or not package.is_active:
        raise DomainError("Seçilen paket bulunamadı veya pasif.")
    if package.currency == offer.currency:
        price = data.price if data.price is not None else package.price
    elif data.price is None:
        raise DomainError(
            f"Paket {package.currency} cinsinden; "
            f"{offer.currency} teklif için paket fiyatını girin."
        )
    else:
        price = data.price

    rates = cost_rates or {}
    missing = sorted(
        {
            item.cost_currency
            for item in package.items
            if item.cost_currency not in {BASE_CURRENCY, offer.currency}
            and item.cost_currency not in rates
        }
    )
    if missing:
        raise DomainError(f"Paket maliyetleri için TL kuru girilmelidir: {', '.join(missing)}.")

    sort = _next_sort(offer)
    header = OfferLine(
        line_type=LineType.PACKAGE,
        package_id=package.id,
        title=package.name,
        description=package.description,
        quantity=Decimal("1"),
        unit_price=price,
        unit_cost=ZERO,
        cost_currency=offer.currency,
        cost_rate=offer.exchange_rate,
        is_visible=True,
        sort_order=sort,
    )
    offer.lines.append(header)
    for index, item in enumerate(package.items, start=1):
        cost_currency = Currency(item.cost_currency)
        offer.lines.append(
            OfferLine(
                line_type=LineType.PACKAGE_COMPONENT,
                parent=header,
                artist_id=item.artist_id,
                service_id=item.service_id,
                title=item.title,
                program_section=item.program_section,
                start_time=item.start_time,
                end_time=item.end_time,
                quantity=item.quantity,
                unit_price=ZERO,
                unit_cost=item.unit_cost,
                cost_currency=cost_currency,
                cost_rate=_cost_rate(offer, cost_currency, rates.get(cost_currency)),
                is_visible=item.is_visible_on_offer,
                sort_order=sort + index,
            )
        )
    return header


def import_package(
    db: Session,
    offer: Offer,
    data: PackageImport,
    cost_rates: dict[Currency, Decimal],
    *,
    actor: User,
    context: RequestContext,
) -> Offer:
    _ensure_editable(offer)
    header = _import_package(db, offer, data, cost_rates)
    return _finish_line_change(
        db,
        offer,
        actor=actor,
        context=context,
        action="offer.package_import",
        summary=f"{offer.offer_no} teklifine paket eklendi: {header.title}.",
        changes={"package_id": data.package_id, "price": str(header.unit_price)},
    )


def update_line(
    db: Session,
    offer: Offer,
    line: OfferLine,
    data: OfferLineUpdate,
    *,
    actor: User,
    context: RequestContext,
) -> Offer:
    _ensure_editable(offer)
    changes = {
        k: v
        for k, v in data.model_dump(exclude_unset=True).items()
        if v is not None or k in {"description", "program_section", "start_time", "end_time"}
    }
    if line.line_type == LineType.PACKAGE_COMPONENT and changes.get("unit_price", ZERO) != 0:
        raise DomainError("Paket içeriği ayrıca fiyatlandırılamaz; paket fiyatını değiştirin.")
    if "cost_currency" in changes or "cost_rate" in changes:
        currency = Currency(changes.get("cost_currency", line.cost_currency))
        given = (
            changes.get("cost_rate")
            if "cost_rate" in changes
            else (line.cost_rate if currency == line.cost_currency else None)
        )
        changes["cost_rate"] = _cost_rate(offer, currency, given)
    diff = audit.apply_changes(line, changes, LINE_AUDIT_FIELDS + ["sort_order", "description"])
    if (line.start_time is None) != (line.end_time is None):
        raise DomainError("Başlangıç ve bitiş saati birlikte girilmelidir.")
    _check_hidden_price(line.is_visible, line.unit_price)
    return _finish_line_change(
        db,
        offer,
        actor=actor,
        context=context,
        action="offer.line_update",
        summary=f"{offer.offer_no} teklif satırı güncellendi: {line.title}.",
        changes=diff,
    )


def delete_line(
    db: Session, offer: Offer, line: OfferLine, *, actor: User, context: RequestContext
) -> Offer:
    _ensure_editable(offer)
    title = line.title
    for child in [child for child in offer.lines if child.parent_id == line.id]:
        offer.lines.remove(child)
    offer.lines.remove(line)
    return _finish_line_change(
        db,
        offer,
        actor=actor,
        context=context,
        action="offer.line_delete",
        summary=f"{offer.offer_no} teklifinden satır silindi: {title}.",
        changes=None,
    )


# --- Anlaşmaya çevirme ---


def convert_to_event(
    db: Session, offer: Offer, note: str | None, *, actor: User, context: RequestContext
) -> Event:
    if offer.status not in CONVERTIBLE:
        raise DomainError(
            f"'{STATUS_LABELS[offer.status]}' durumundaki teklif anlaşmaya çevrilemez. "
            "Teklif önce müşteriye gönderilmiş olmalıdır."
        )
    if _event_id(db, offer.id) is not None:
        raise DomainError("Bu teklif zaten anlaşmaya çevrilmiş.")
    customer = _customer(db, offer.customer_id)
    _partner(db, offer.partner_id, actor)
    recalculate(offer)
    _validate_ready(offer)
    if offer.event_date is None:
        raise DomainError(
            "Anlaşma için etkinlik tarihi zorunludur; teklifi taslağa alıp tarih girin."
        )

    now = clock.now()
    event = Event(
        event_no=next_number(db, "event", now.year, "VIA-E"),
        offer_id=offer.id,
        customer_id=offer.customer_id,
        contact_id=offer.contact_id,
        venue_id=offer.venue_id,
        partner_id=offer.partner_id,
        title=offer.title,
        event_date=offer.event_date,
        start_time=offer.event_start,
        end_time=offer.event_end,
        guest_count=offer.guest_count,
        invoice_type=offer.invoice_type,
        vat_rate=offer.vat_rate,
        currency=offer.currency,
        exchange_rate=offer.exchange_rate,
        net_amount=offer.net_amount,
        vat_amount=offer.vat_amount,
        total_amount=offer.total_amount,
        advance_amount=offer.advance_amount,
        base_net_amount=money(offer.net_amount * offer.exchange_rate),
        base_total_amount=money(offer.total_amount * offer.exchange_rate),
        payment_terms=offer.payment_terms,
        notes=note,
        agreed_at=now,
        search_text=fold(offer.title, customer.name),
        items=[],
    )
    db.add(event)
    db.flush()
    event.search_text = fold(event.event_no, offer.title, customer.name)
    _copy_lines(offer.lines, event.items, EventItem)
    db.flush()
    # Müşteri borcu, gelir/KDV, sanatçı-tedarikçi borçları ve ödeme planı
    finance_agreements.on_agreement(db, event, actor)
    # Standart operasyon görevleri ve sanatçı rider kontrol listesi
    operations.on_agreement(db, event)

    previous = offer.status
    offer.status = OfferStatus.CONVERTED
    offer.decided_at = offer.decided_at or now
    audit.record(
        db,
        actor=actor,
        action="offer.convert",
        entity_type="offer",
        entity_id=offer.id,
        summary=f"{offer.offer_no} teklifi anlaşmaya çevrildi; {event.event_no} etkinliği açıldı.",
        changes={"status": {"before": str(previous), "after": str(OfferStatus.CONVERTED)}},
        context=context,
    )
    audit.record(
        db,
        actor=actor,
        action="event.create",
        entity_type="event",
        entity_id=event.id,
        summary=(
            f"{event.event_no} etkinliği {offer.offer_no} teklifinden oluşturuldu: "
            f"{event.title} ({customer.name}), {event.total_amount} {event.currency}."
        ),
        context=context,
    )
    db.commit()
    db.refresh(event)
    return event


# --- Yazdırma ---


def offer_print(db: Session, offer: Offer) -> OfferPrint:
    settings = get_company_settings(db)
    customer = offer.customer
    top_level = [line for line in offer.lines if line.parent_id is None and line.is_visible]
    lines = []
    for line in top_level:
        components = [
            PrintLine(
                title=child.title,
                description=child.description,
                start_time=child.start_time,
                end_time=child.end_time,
                quantity=child.quantity,
                unit_price=None,
                line_total=None,
            )
            for child in offer.lines
            if child.parent_id == line.id and child.is_visible
        ]
        lines.append(
            PrintLine(
                title=line.title,
                description=line.description,
                start_time=line.start_time,
                end_time=line.end_time,
                quantity=line.quantity,
                unit_price=line.unit_price,
                line_total=line_total(line),
                components=components,
            )
        )
    address = ", ".join(filter(None, [customer.address, customer.district, customer.city]))
    tax = " / ".join(filter(None, [customer.tax_office, customer.tax_number]))
    return OfferPrint(
        company=CompanyInfo.model_validate(settings),
        offer_no=offer.offer_no,
        offer_date=offer.offer_date,
        valid_until=offer.valid_until,
        title=offer.title,
        customer_name=customer.name,
        customer_address=address or None,
        customer_tax=tax or None,
        contact_name=offer.contact.full_name if offer.contact else None,
        contact_phone=offer.contact.phone if offer.contact else None,
        venue_name=offer.venue.name if offer.venue else None,
        event_date=offer.event_date,
        event_start=offer.event_start,
        event_end=offer.event_end,
        guest_count=offer.guest_count,
        invoice_type=offer.invoice_type,
        vat_rate=offer.vat_rate,
        currency=offer.currency,
        lines=lines,
        subtotal=offer.subtotal,
        discount_amount=offer.discount_amount,
        net_amount=offer.net_amount,
        vat_amount=offer.vat_amount,
        total_amount=offer.total_amount,
        advance_amount=offer.advance_amount,
        remaining_amount=money(offer.total_amount - offer.advance_amount),
        payment_terms=offer.payment_terms,
        customer_notes=offer.customer_notes,
    )
