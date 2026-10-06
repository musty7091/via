"""Döviz kurları: TCMB'den otomatik çekme, elle düzeltme, tarihe göre öneri."""

import logging
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.deps import RequestContext
from app.core.errors import DomainError
from app.core.money import BASE_CURRENCY, Currency, rate
from app.core.schemas import ApiModel
from app.modules.audit import service as audit
from app.modules.rates.models import ExchangeRate, RateSource
from app.modules.users.models import User

log = logging.getLogger(__name__)

TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml"
FOREIGN = [c for c in Currency if c != BASE_CURRENCY]
# Otomatik çekme en fazla saatte bir denenir (TCMB günde bir bülten yayımlar).
_last_attempt = 0.0


class RateRead(ApiModel):
    currency: Currency
    rate: Decimal
    day: date
    source: RateSource


class RateSet(ApiModel):
    day: date
    currency: Currency
    rate: Decimal


# --- TCMB ---


def _download() -> bytes:
    request = urllib.request.Request(TCMB_URL, headers={"User-Agent": "VIA-EVENTS/2.0"})
    with urllib.request.urlopen(request, timeout=5) as response:  # noqa: S310 (sabit https adresi)
        return response.read()


def parse_tcmb(xml: bytes) -> tuple[date, dict[Currency, Decimal]]:
    root = ET.fromstring(xml)
    day = datetime.strptime(root.attrib["Tarih"], "%d.%m.%Y").date()
    rates: dict[Currency, Decimal] = {}
    for node in root.findall("Currency"):
        code = node.attrib.get("CurrencyCode")
        if code not in {c.value for c in FOREIGN}:
            continue
        try:
            unit = Decimal(node.findtext("Unit") or "1")
            selling = Decimal(node.findtext("ForexSelling") or "")
        except InvalidOperation:
            continue
        if selling > 0:
            rates[Currency(code)] = rate(selling / unit)
    return day, rates


def fetch_tcmb(db: Session) -> list[RateRead]:
    """TCMB bültenini çeker ve kaydeder. Aynı gün elle girilmiş kurun üzerine yazmaz."""
    try:
        day, rates = parse_tcmb(_download())
    except Exception as exc:  # ağ, XML veya tarih hatası
        log.warning("TCMB kurları alınamadı: %s", exc)
        raise DomainError("TCMB kurlarına şu an ulaşılamıyor. Kuru elle girebilirsiniz.") from exc
    for currency, value in rates.items():
        row = db.scalar(
            select(ExchangeRate).where(ExchangeRate.day == day, ExchangeRate.currency == currency)
        )
        if row is None:
            db.add(ExchangeRate(day=day, currency=currency, rate=value, source=RateSource.TCMB))
        elif row.source == RateSource.TCMB:
            row.rate = value
    db.commit()
    return latest_rates(db, day)


def _maybe_refresh(db: Session) -> None:
    """Bugünün kuru sorulduğunda, son TCMB bülteni dünden eskiyse sessizce yeniler."""
    global _last_attempt
    if time.monotonic() - _last_attempt < 3600:
        return
    newest = db.scalar(
        select(ExchangeRate.day)
        .where(ExchangeRate.source == RateSource.TCMB)
        .order_by(ExchangeRate.day.desc())
        .limit(1)
    )
    today = clock.today()
    if newest is not None and (today - newest).days < 1:
        return
    _last_attempt = time.monotonic()
    try:
        fetch_tcmb(db)
    except DomainError:
        db.rollback()


# --- Okuma / yazma ---


def latest_rates(db: Session, on: date) -> list[RateRead]:
    """Her döviz için verilen tarihte veya öncesindeki en yeni kur."""
    result = []
    for currency in FOREIGN:
        row = db.scalar(
            select(ExchangeRate)
            .where(ExchangeRate.currency == currency, ExchangeRate.day <= on)
            .order_by(ExchangeRate.day.desc())
            .limit(1)
        )
        if row:
            result.append(
                RateRead(currency=row.currency, rate=row.rate, day=row.day, source=row.source)
            )
    return result


def rates_for(db: Session, on: date) -> list[RateRead]:
    if on >= clock.today():
        _maybe_refresh(db)
    return latest_rates(db, on)


def set_rate(db: Session, data: RateSet, *, actor: User, context: RequestContext) -> RateRead:
    if data.currency == BASE_CURRENCY:
        raise DomainError("TL için kur girilmez.")
    if data.rate <= 0:
        raise DomainError("Kur sıfırdan büyük olmalıdır.")
    if data.day > clock.today():
        raise DomainError("İleri tarihli kur girilemez.")
    value = rate(data.rate)
    row = db.scalar(
        select(ExchangeRate).where(
            ExchangeRate.day == data.day, ExchangeRate.currency == data.currency
        )
    )
    before = str(row.rate) if row else None
    if row is None:
        row = ExchangeRate(day=data.day, currency=data.currency, rate=value)
        db.add(row)
    row.rate = value
    row.source = RateSource.MANUAL
    row.updated_by_id = actor.id
    audit.record(
        db,
        actor=actor,
        action="rate.set",
        entity_type="exchange_rate",
        entity_id=None,
        summary=f"{data.day:%d.%m.%Y} {data.currency} kuru {value} olarak girildi.",
        changes={"rate": {"before": before, "after": str(value)}},
        context=context,
    )
    db.commit()
    return RateRead(currency=row.currency, rate=row.rate, day=row.day, source=row.source)
