"""Eylül 2026 senaryo dönemi: işletmenin karşılaşabileceği durumların tamamı.

Her işlem gerçek gününde, normal servisler üzerinden yapılır (saat o güne ayarlanır);
böylece defter, kasa yeterlilik kontrolleri ve işlem geçmişi gerçek kullanımdaki gibi oluşur.

Senaryolar:
- TL / EUR / GBP / USD işler, faturalı (KDV %16) ve faturasız
- Tam tahsil + kapanış (kâr dağıtımı), zararla kapanış, alacak silerek kapanış
- Kısmi tahsilat, vadesi geçmiş alacak, sadece kapora alınmış ileri tarihli işler
- Kur farkı doğuran döviz tahsilat/ödemeleri
- Ortağın elden tahsil edip kısmen teslim ettiği para, ortağın cebinden ödediği borç/gider
- Sanatçı, dans grubu, DJ ve tedarikçi ödemeleri (tam, kısmi, hiç)
- Genel giderler (kira, aylara bölünen sigorta, reklam, yakıt, ödenmemiş muhasebe ücreti)
- Kasa → banka transferi, ortaklara ödeme
- İptal edilen etkinlik, reddedilen / bekleyen / taslak teklifler, operasyon kayıtları
"""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.deps import RequestContext
from app.modules.catalog import service as catalog
from app.modules.catalog.models import Artist, Package, ServiceItem
from app.modules.catalog.schemas import ArtistCreate, ServiceCreate, SupplierCreate
from app.modules.closing import events as event_closing
from app.modules.customers import service as customers
from app.modules.customers.models import Customer, Venue
from app.modules.customers.schemas import ContactCreate, CustomerCreate, VenueCreate
from app.modules.events import service as event_service
from app.modules.events.models import Event
from app.modules.finance import cash, collections, expenses, partners, payables
from app.modules.finance.models import CashAccount, Payable
from app.modules.offers import service as offers
from app.modules.offers.schemas import OfferCreate, OfferLineCreate, PackageImport
from app.modules.operations import service as operations
from app.modules.operations.models import EventTask, RiderCheck
from app.modules.partners.models import Partner
from app.modules.rates.models import ExchangeRate, RateSource
from app.modules.users.models import User

CTX = RequestContext(ip_address=None, user_agent="seed-demo")
D = Decimal
TZ = ZoneInfo("Europe/Istanbul")


@contextmanager
def on(day: date, hour: int = 11) -> Iterator[None]:
    """Sistem saatini geçici olarak verilen güne ayarlar."""
    original = clock.now
    clock.now = lambda: datetime.combine(day, time(hour, 0), TZ)  # type: ignore[assignment]
    try:
        yield
    finally:
        clock.now = original  # type: ignore[assignment]


def sep(day: int) -> date:
    return date(2026, 9, day)


def oct_(day: int) -> date:
    return date(2026, 10, day)


# --- Kurlar (TCMB döviz satış benzeri, gün gün hafif yükselen) ---

RATE_PATH = {
    "EUR": (D("54.20"), D("55.08")),
    "GBP": (D("64.40"), D("65.13")),
    "USD": (D("48.55"), D("49.16")),
}
RATE_START, RATE_END = sep(1), oct_(5)


def rate_on(currency: str, day: date) -> Decimal:
    start, end = RATE_PATH[currency]
    span = (RATE_END - RATE_START).days
    step = (end - start) / span
    return (start + step * (day - RATE_START).days).quantize(D("0.0001"))


def seed_rates(db: Session) -> None:
    day = RATE_START
    while day <= RATE_END:
        if day.weekday() < 5:  # hafta sonu bülten yayımlanmaz
            for currency in RATE_PATH:
                db.add(
                    ExchangeRate(
                        day=day,
                        currency=currency,
                        rate=rate_on(currency, day),
                        source=RateSource.TCMB,
                    )
                )
        day += timedelta(days=1)
    db.commit()


# --- Kısa yardımcılar ---


class Scenario:
    def __init__(self, db: Session, users: dict[str, User], partner: dict[str, Partner]) -> None:
        self.db = db
        self.admin = users["admin"]
        self.accounting = users["accounting"]
        self.crew = users["operation"]
        self.partner = partner
        self.accounts: dict[str, CashAccount] = {}

    # Katalog / müşteri arama
    def customer(self, name: str) -> Customer:
        return self.db.scalar(select(Customer).where(Customer.name == name))

    def venue(self, name: str) -> Venue:
        return self.db.scalar(select(Venue).where(Venue.name == name))

    def artist(self, name: str) -> Artist:
        return self.db.scalar(select(Artist).where(Artist.name == name))

    def service(self, name: str) -> ServiceItem:
        return self.db.scalar(select(ServiceItem).where(ServiceItem.name == name))

    def payable(self, event: Event, title: str) -> Payable:
        return self.db.scalar(
            select(Payable).where(Payable.event_id == event.id, Payable.title == title)
        )

    @property
    def kw(self) -> dict:
        return {"actor": self.admin, "context": CTX}

    @property
    def acc(self) -> dict:
        """Finans kayıtlarını muhasebe girer (işlem geçmişinde gerçekçi görünür)."""
        return {"actor": self.accounting, "context": CTX}

    # Satış
    def agreement(
        self,
        day: date,
        *,
        customer: str,
        partner: str,
        title: str,
        event_date: date,
        lines: list[OfferLineCreate],
        currency: str = "TRY",
        invoice: str = "without_invoice",
        advance: str = "0",
        venue: str | None = None,
        guests: int | None = None,
        start: time | None = time(20, 0),
        end: time | None = time(1, 0),
        package: tuple[str, str] | None = None,
        notes: str | None = None,
        convert: bool = True,
    ) -> Event | None:
        db = self.db
        cust = self.customer(customer)
        with on(day, 10):
            offer = offers.create_offer(
                db,
                OfferCreate(
                    customer_id=cust.id,
                    contact_id=cust.contacts[0].id if cust.contacts else None,
                    venue_id=self.venue(venue).id if venue else None,
                    partner_id=self.partner[partner].id,
                    title=title,
                    event_date=event_date,
                    event_start=start,
                    event_end=end,
                    guest_count=guests,
                    invoice_type=invoice,
                    currency=currency,
                    exchange_rate=None if currency == "TRY" else rate_on(currency, day),
                    advance_amount=D(advance),
                    internal_notes=notes,
                ),
                **self.kw,
            )
            if package:
                name, price = package
                pkg = db.scalar(select(Package).where(Package.name == name))
                offers.import_package(
                    db,
                    offer,
                    PackageImport(package_id=pkg.id, price=D(price)),
                    {c: rate_on(c, day) for c in ("EUR", "GBP", "USD")},
                    **self.kw,
                )
            for line in lines:
                offers.add_line(db, offer, line, **self.kw)
            offers.change_status(db, offer, "send", None, **self.kw)
            if not convert:
                return None
            offers.change_status(db, offer, "accept", None, **self.kw)
            event = offers.convert_to_event(db, offer, None, **self.kw)
        return db.get(Event, event.id)

    def artist_line(
        self,
        name: str,
        price: str,
        cost: str | None = None,
        *,
        cost_currency: str | None = None,
        day: date | None = None,
        section: str = "main",
        at: tuple[time, time] | None = None,
    ) -> OfferLineCreate:
        rate = (
            rate_on(cost_currency, day)
            if cost_currency and cost_currency != "TRY" and day
            else None
        )
        return OfferLineCreate(
            line_type="artist",
            artist_id=self.artist(name).id,
            unit_price=D(price),
            unit_cost=D(cost) if cost else None,
            cost_currency=cost_currency,
            cost_rate=rate,
            program_section=section,
            start_time=at[0] if at else None,
            end_time=at[1] if at else None,
        )

    def service_line(
        self, name: str, price: str, cost: str | None = None, quantity: str = "1"
    ) -> OfferLineCreate:
        return OfferLineCreate(
            line_type="service",
            service_id=self.service(name).id,
            unit_price=D(price),
            unit_cost=D(cost) if cost else None,
            cost_currency="TRY" if cost else None,
            quantity=D(quantity),
            program_section="technical",
        )

    # Finans
    def collect(
        self,
        event: Event,
        day: date,
        amount: str,
        currency: str = "TRY",
        *,
        account: str | None = None,
        partner: str | None = None,
        method: str = "cash",
        applied: str | None = None,
        doc: str | None = None,
    ) -> None:
        with on(day, 14):
            collections.create_collection(
                self.db,
                event=self.db.get(Event, event.id),
                collection_date=day,
                amount=D(amount),
                currency=currency,
                rate=None if currency == "TRY" else rate_on(currency, day),
                applied_amount=D(applied) if applied else None,
                cash_account_id=self.accounts[account].id if account else None,
                partner_id=self.partner[partner].id if partner else None,
                method=method,
                document_no=doc,
                note=None,
                **self.acc,
            )

    def pay(
        self,
        event: Event,
        title: str,
        day: date,
        amount: str,
        currency: str = "TRY",
        *,
        account: str | None = None,
        partner: str | None = None,
        method: str = "bank_transfer",
        applied: str | None = None,
    ) -> None:
        with on(day, 15):
            payables.pay(
                self.db,
                self.payable(event, title),
                payment_date=day,
                amount=D(amount),
                currency=currency,
                rate=None if currency == "TRY" else rate_on(currency, day),
                applied_amount=D(applied) if applied else None,
                cash_account_id=self.accounts[account].id if account else None,
                partner_id=self.partner[partner].id if partner else None,
                method=method,
                document_no=None,
                note=None,
                **self.acc,
            )

    def expense(
        self,
        day: date,
        category: str,
        title: str,
        amount: str,
        *,
        paid_by: str = "company",
        account: str | None = None,
        partner: str | None = None,
        event: Event | None = None,
        supplier: str | None = None,
        allocation: str = "month",
    ) -> None:
        supplier_id = None
        if supplier:
            from app.modules.catalog.models import Supplier

            supplier_id = self.db.scalar(select(Supplier.id).where(Supplier.name == supplier))
        with on(day, 16):
            expenses.create_expense(
                self.db,
                expense_date=day,
                category=category,
                title=title,
                amount=D(amount),
                currency="TRY",
                rate=None,
                event_id=event.id if event else None,
                paid_by=paid_by,
                cash_account_id=self.accounts[account].id if account else None,
                allocation=allocation,
                partner_id=self.partner[partner].id if partner else None,
                supplier_id=supplier_id,
                document_no=None,
                note=None,
                **self.acc,
            )

    def partner_tx(
        self,
        kind: str,
        partner: str,
        day: date,
        amount: str,
        currency: str,
        account: str,
        note: str | None = None,
    ) -> None:
        with on(day, 17):
            partners.create_transaction(
                self.db,
                kind=kind,
                partner_id=self.partner[partner].id,
                tx_date=day,
                amount=D(amount),
                currency=currency,
                cash_account_id=self.accounts[account].id,
                note=note,
                **self.acc,
            )

    # Etkinlik akışı
    def complete(self, event: Event, day: date) -> None:
        with on(day, 12):
            event_service.change_status(
                self.db, self.db.get(Event, event.id), "complete", None, **self.kw
            )

    def close(self, event: Event, day: date, note: str) -> None:
        with on(day, 18):
            event_closing.close_event(self.db, self.db.get(Event, event.id), note, **self.kw)

    def finish_operations(
        self,
        event: Event,
        day: date,
        guests: int,
        went_well: str,
        issues: str | None = None,
        *,
        submit: bool = True,
    ) -> None:
        db = self.db
        with on(day, 9):
            for task in db.scalars(select(EventTask).where(EventTask.event_id == event.id)):
                task.assigned_to_id = self.crew.id
                operations.update_task(
                    db, task, operations.TaskUpdate(status="done"), actor=self.crew
                )
            for check in db.scalars(select(RiderCheck).where(RiderCheck.event_id == event.id)):
                operations.update_rider_check(
                    db,
                    check,
                    operations.RiderCheckUpdate(status="ok"),
                    actor=self.crew,
                    context=CTX,
                )
            operations.save_report(
                db,
                db.get(Event, event.id),
                operations.ReportSave(
                    actual_guest_count=guests, went_well=went_well, issues=issues, submit=submit
                ),
                actor=self.crew,
                context=CTX,
            )


# --- Katalog ve müşteri eklemeleri ---


def seed_extras(s: Scenario) -> None:
    db, kw = s.db, s.kw
    for name, ctype, extra in [
        ("Demir Ailesi", "individual", {"phone": "0533 862 14 20", "city": "Girne"}),
        ("Özdemir Ailesi", "individual", {"phone": "0542 851 33 09", "city": "Lefkoşa"}),
        ("Aksoy Ailesi", "individual", {"phone": "0548 870 45 12", "city": "Girne"}),
        (
            "Lord's Palace Hotel",
            "hotel",
            {"default_currency": "GBP", "payment_term_days": 7, "city": "Girne"},
        ),
        (
            "Girne Belediyesi",
            "public",
            {
                "default_invoice": "with_invoice",
                "payment_term_days": 30,
                "city": "Girne",
                "risk_level": "watch",
                "risk_note": "Hakediş kesintisi yapabiliyor.",
            },
        ),
        (
            "Kıbrıs Türk Ticaret Odası",
            "organizer",
            {"default_invoice": "with_invoice", "default_currency": "USD", "city": "Lefkoşa"},
        ),
        ("Acapulco Resort", "hotel", {"default_currency": "EUR", "city": "Girne"}),
        ("Bellapais Kültür Derneği", "other", {"city": "Girne"}),
        ("Salamis Bay Conti", "hotel", {"city": "Gazimağusa"}),
    ]:
        customer = customers.create_customer(
            db, CustomerCreate(customer_type=ctype, name=name, **extra), **kw
        )
        contact = {
            "Demir Ailesi": "Elif Demir",
            "Özdemir Ailesi": "Can Özdemir",
            "Aksoy Ailesi": "Deniz Aksoy",
            "Lord's Palace Hotel": "James Carter",
            "Girne Belediyesi": "Kültür İşleri Müdürlüğü",
            "Kıbrıs Türk Ticaret Odası": "Ayten Kurt",
            "Acapulco Resort": "Mert Güler",
        }.get(name)
        if contact:
            customers.create_contact(
                db, customer, ContactCreate(full_name=contact, phone=extra.get("phone")), **kw
            )

    for name, vtype, city, capacity in [
        ("Lord's Palace Balo Salonu", "hall", "Girne", 600),
        ("Girne Amfi Tiyatro", "open_air", "Girne", 2000),
        ("Bellapais Manastırı", "open_air", "Girne", 400),
        ("Acapulco Plaj Sahnesi", "beach", "Girne", 1200),
    ]:
        customers.create_venue(
            db, VenueCreate(name=name, venue_type=vtype, city=city, capacity=capacity), **kw
        )

    lale = catalog.create_supplier(
        db,
        SupplierCreate(
            name="Lale Çiçek & Dekor", contact_name="Lale Arslan", phone="0533 840 11 22"
        ),
        **kw,
    )
    catalog.create_supplier(
        db, SupplierCreate(name="Ercan Mali Müşavirlik", contact_name="Ercan Tuna"), **kw
    )
    catalog.create_service(
        db,
        ServiceCreate(
            service_type="decoration",
            name="Çiçek ve Masa Dekoru",
            unit="set",
            supplier_id=lale.id,
            default_cost=D("18000"),
            default_price=D("35000"),
        ),
        **kw,
    )
    catalog.create_artist(
        db,
        ArtistCreate(
            artist_type="dance_group",
            name="Fuego Latino Dans Grubu",
            default_cost=D("25000"),
            default_price=D("40000"),
        ),
        **kw,
    )
    catalog.create_artist(
        db,
        ArtistCreate(
            artist_type="dj", name="DJ Kaan", default_cost=D("12000"), default_price=D("25000")
        ),
        **kw,
    )
    catalog.create_artist(
        db,
        ArtistCreate(
            artist_type="solo",
            name="Elena Rossi",
            default_cost=D("4000"),
            cost_currency="EUR",
            default_price=D("6500"),
            price_currency="EUR",
        ),
        **kw,
    )

    for name, ctype, currency, order in [
        ("Merkez Kasa", "cash", "TRY", 1),
        ("İş Bankası", "bank", "TRY", 2),
        ("Euro Kasa", "cash", "EUR", 3),
        ("Sterlin Kasa", "cash", "GBP", 4),
        ("Dolar Kasa", "cash", "USD", 5),
    ]:
        account = cash.create_account(
            db, name=name, account_type=ctype, currency=currency, iban=None, **kw
        )
        account.sort_order = order
        s.accounts[name] = account
    db.commit()


# --- Eylül senaryosu ---


def seed_september(s: Scenario) -> None:
    db = s.db
    a, sl = s.artist_line, s.service_line

    # 1) Demir–Yılmaz Düğünü — TL, kapora + kalan, tüm ödemeler, kapanış (kâr)
    wedding = s.agreement(
        sep(1),
        customer="Demir Ailesi",
        partner="Alper",
        title="Demir–Yılmaz Düğünü",
        event_date=sep(13),
        venue="Escape Beach",
        guests=400,
        advance="100000",
        lines=[
            a("Asena", "150000", "80000", at=(time(22, 0), time(23, 30))),
            a(
                "Anatolia Dans Topluluğu",
                "45000",
                "30000",
                section="opening",
                at=(time(21, 0), time(21, 20)),
            ),
            sl("Bang Olufsen Ses Sistemi", "40000", "25000"),
            sl("Sahne Işık Paketi", "25000", "15000"),
            sl("Çiçek ve Masa Dekoru", "40000", "22000"),
        ],
    )
    s.collect(wedding, sep(1), "100000", account="Merkez Kasa", doc="Kapora makbuzu 0001")

    # Genel gider: Eylül kirası (kasadan)
    s.expense(sep(2), "rent", "Ofis kirası (Eylül)", "18000", account="Merkez Kasa")
    # Yıllık sigorta: Volkan cebinden ödedi; tüm sezona ait (Ocak–Aralık).
    # Ocak–Ağustos payı Eylül'e yazılır.
    s.expense(
        sep(2),
        "other",
        "Yıllık işyeri sigortası",
        "24000",
        paid_by="partner",
        partner="Volkan",
        allocation="season",
    )

    # 2) Özdemir Nişanı — arkadaş fiyatı, zararla kapanış
    engagement = s.agreement(
        sep(2),
        customer="Özdemir Ailesi",
        partner="Volkan",
        title="Özdemir Nişanı",
        event_date=sep(6),
        guests=120,
        start=time(19, 0),
        end=time(23, 30),
        lines=[
            a("Asena", "70000", "80000"),
            a("Fuego Latino Dans Grubu", "15000", "25000", section="opening"),
            sl("Çiçek ve Masa Dekoru", "10000", "12000"),
        ],
        notes="Ortağın tanıdığı; maliyetin altında fiyat verildi.",
    )

    # 3) Merit Park Sonbahar Galası — EUR, faturalı, kur farkı
    gala = s.agreement(
        sep(3),
        customer="Merit Park Hotel",
        partner="Volkan",
        title="Merit Park Sonbahar Galası",
        event_date=sep(19),
        currency="EUR",
        invoice="with_invoice",
        advance="5000",
        venue="Merit Park Balo Salonu",
        guests=250,
        lines=[
            a(
                "Elena Rossi",
                "6500",
                "4000",
                cost_currency="EUR",
                day=sep(3),
                at=(time(21, 30), time(23, 0)),
            ),
            a("Sidar Karakuş", "4000", "2500", cost_currency="EUR", day=sep(3), section="closing"),
            sl("LED Ekran 4x3 m", "1200", "18000"),
            sl("Sahne Işık Paketi", "800", "15000"),
        ],
    )
    s.collect(gala, sep(4), "5000", "EUR", account="Euro Kasa", method="bank_transfer")

    # 4) Girne Belediyesi Zeytin Festivali — faturalı, hakediş kesintisi (alacak silinir)
    festival = s.agreement(
        sep(4),
        customer="Girne Belediyesi",
        partner="İbrahim",
        title="Zeytin Festivali Konseri",
        event_date=sep(12),
        invoice="with_invoice",
        venue="Girne Amfi Tiyatro",
        guests=1500,
        start=time(20, 30),
        end=time(23, 30),
        lines=[
            a("Grup Frekans", "110000", "50000"),
            a("Anatolia Dans Topluluğu", "40000", "30000", section="opening"),
            sl("Bang Olufsen Ses Sistemi", "40000", "25000"),
            sl("LED Ekran 4x3 m", "30000", "18000"),
        ],
    )

    s.collect(engagement, sep(6), "95000", account="Merkez Kasa", doc="Elden")
    s.complete(engagement, sep(7))
    s.pay(engagement, "Asena", sep(8), "80000", account="Merkez Kasa", method="cash")
    s.pay(
        engagement, "Fuego Latino Dans Grubu", sep(8), "25000", account="Merkez Kasa", method="cash"
    )
    s.pay(engagement, "Çiçek ve Masa Dekoru", sep(8), "12000", account="Merkez Kasa", method="cash")

    # 5) Lord's Palace Gala Dinner — GBP, ortak elden tahsil eder
    lords = s.agreement(
        sep(8),
        customer="Lord's Palace Hotel",
        partner="Alper",
        title="Lord's Palace Gala Dinner",
        event_date=sep(27),
        currency="GBP",
        venue="Lord's Palace Balo Salonu",
        guests=300,
        lines=[
            a("Asena", "2600", "80000", cost_currency="TRY"),
            a("Fuego Latino Dans Grubu", "1000", "25000", cost_currency="TRY", section="opening"),
            sl("LED Ekran 4x3 m", "600", "18000"),
            sl("Sahne Işık Paketi", "400", "15000"),
        ],
    )
    s.close(engagement, sep(10), "Tahsilat tamam; zarar ortaklara bölündü.")

    # 6) Near East Bank Kurumsal Kokteyl — faturalı, kısmi tahsilat, ödenmemiş sanatçı
    cocktail = s.agreement(
        sep(10),
        customer="Near East Bank",
        partner="İbrahim",
        title="Near East Bank Kurumsal Kokteyl",
        event_date=sep(25),
        invoice="with_invoice",
        guests=150,
        start=time(19, 0),
        end=time(22, 0),
        lines=[
            a("Grup Frekans", "90000", "50000"),
            sl("Bang Olufsen Ses Sistemi", "40000", "25000"),
            OfferLineCreate(
                line_type="custom", title="Kokteyl karşılama programı", unit_price=D("20000")
            ),
        ],
    )

    # 7) Bellapais Klasik Müzik Gecesi — anlaşıldı, sonra iptal
    concert = s.agreement(
        sep(10),
        customer="Bellapais Kültür Derneği",
        partner="Volkan",
        title="Bellapais Klasik Müzik Gecesi",
        event_date=oct_(10),
        venue="Bellapais Manastırı",
        guests=350,
        lines=[a("Elena Rossi", "180000", "4000", cost_currency="EUR", day=sep(10))],
    )

    s.complete(festival, sep(13))
    s.expense(
        sep(12),
        "food",
        "Ekip yemeği (festival)",
        "3500",
        paid_by="partner",
        partner="Alper",
        event=festival,
    )
    s.pay(
        festival, "Anatolia Dans Topluluğu", sep(12), "30000", account="Merkez Kasa", method="cash"
    )

    s.complete(wedding, sep(14))
    s.expense(
        sep(13),
        "transport",
        "Sahne ekipmanı nakliyesi",
        "4000",
        account="Merkez Kasa",
        event=wedding,
    )
    s.collect(wedding, sep(14), "200000", account="İş Bankası", method="bank_transfer", doc="EFT")
    s.pay(wedding, "Anatolia Dans Topluluğu", sep(14), "30000", account="İş Bankası")
    s.pay(wedding, "Asena", sep(15), "80000", account="İş Bankası")
    s.expense(sep(15), "marketing", "Instagram reklam kampanyası", "7500", account="İş Bankası")
    s.expense(sep(15), "transport", "Araç yakıtı", "6500", paid_by="partner", partner="Volkan")
    # Depo kirası: Eylül'den sezon sonuna (Aralık) kadar 4 aya bölünür
    s.expense(
        sep(15),
        "rent",
        "Ekipman deposu kirası (Eylül–Aralık)",
        "12000",
        account="İş Bankası",
        allocation="rest_of_season",
    )

    # 8) Acapulco Cadılar Bayramı Partisi — EUR paket, sadece kapora (Ekim'e devreder)
    halloween = s.agreement(
        sep(15),
        customer="Acapulco Resort",
        partner="Volkan",
        title="Acapulco Cadılar Bayramı Partisi",
        event_date=oct_(31),
        currency="EUR",
        advance="2000",
        venue="Acapulco Plaj Sahnesi",
        guests=900,
        package=("Yaza Merhaba Paketi", "7500"),
        lines=[],
    )
    s.collect(halloween, sep(16), "2000", "EUR", account="Euro Kasa", method="bank_transfer")

    s.pay(wedding, "Bang Olufsen Ses Sistemi", sep(16), "25000", account="İş Bankası")
    s.pay(wedding, "Sahne Işık Paketi", sep(16), "15000", account="İş Bankası")
    s.pay(wedding, "Çiçek ve Masa Dekoru", sep(16), "22000", account="İş Bankası")
    s.close(wedding, sep(18), "Tahsilat ve tüm ödemeler tamam.")

    # 9) Aksoy Doğum Günü — Alper elden tahsil eder, sonra kasaya teslim eder
    birthday = s.agreement(
        sep(15),
        customer="Aksoy Ailesi",
        partner="İbrahim",
        title="Aksoy 40. Yaş Doğum Günü",
        event_date=sep(20),
        guests=80,
        start=time(20, 0),
        end=time(0, 30),
        lines=[a("DJ Kaan", "25000", "12000"), sl("Bang Olufsen Ses Sistemi", "20000", "12500")],
    )

    # 10) Salamis Bay — teklif reddedildi
    with on(sep(17), 10):
        salamis = offers.create_offer(
            db,
            OfferCreate(
                customer_id=s.customer("Salamis Bay Conti").id,
                partner_id=s.partner["Alper"].id,
                title="Salamis Bay Düğün Paketi",
                event_date=oct_(17),
                guest_count=500,
                invoice_type="without_invoice",
            ),
            **s.kw,
        )
        offers.add_line(db, salamis, a("Asena", "160000"), **s.kw)
        offers.add_line(db, salamis, sl("Bang Olufsen Ses Sistemi", "40000"), **s.kw)
        offers.change_status(db, salamis, "send", None, **s.kw)
    with on(sep(18), 10):
        offers.change_status(db, salamis, "reject", "Müşteri bütçesini aştığını belirtti.", **s.kw)

    s.complete(gala, sep(20))
    s.pay(gala, "Elena Rossi", sep(20), "4000", "EUR", account="Euro Kasa")
    s.pay(gala, "Sidar Karakuş", sep(20), "2500", "EUR", account="Euro Kasa")

    s.collect(birthday, sep(20), "45000", partner="Alper", doc="Elden")
    s.complete(birthday, sep(21))
    s.pay(birthday, "DJ Kaan", sep(21), "12000", account="Merkez Kasa", method="cash")

    with on(sep(21), 11):
        event_service.change_status(
            db,
            db.get(Event, concert.id),
            "cancel",
            "Sponsor çekildi; dernek etkinliği iptal etti.",
            **s.kw,
        )

    s.collect(
        gala, sep(22), "9500", "EUR", account="Euro Kasa", method="bank_transfer", doc="SWIFT"
    )
    s.collect(
        festival,
        sep(22),
        "240000",
        account="İş Bankası",
        method="bank_transfer",
        doc="Belediye hakediş",
    )
    s.pay(festival, "Grup Frekans", sep(23), "50000", account="İş Bankası")
    s.pay(festival, "Bang Olufsen Ses Sistemi", sep(23), "25000", account="İş Bankası")
    s.pay(festival, "LED Ekran 4x3 m", sep(23), "18000", account="İş Bankası")

    s.partner_tx(
        "handover", "Alper", sep(23), "45000", "TRY", "Merkez Kasa", "Aksoy doğum günü tahsilatı"
    )
    s.pay(birthday, "Bang Olufsen Ses Sistemi", sep(23), "12500", account="İş Bankası")
    s.close(birthday, sep(24), "Tahsilat kasaya teslim edildi.")

    # 11) KTTO Yıl Sonu Galası — USD, faturalı, kapora (Aralık)
    ktto = s.agreement(
        sep(24),
        customer="Kıbrıs Türk Ticaret Odası",
        partner="Alper",
        title="KTTO Yıl Sonu Galası",
        event_date=date(2026, 12, 18),
        currency="USD",
        invoice="with_invoice",
        advance="5000",
        venue="Merit Park Balo Salonu",
        guests=450,
        lines=[
            a("Elena Rossi", "7000", "4000", cost_currency="EUR", day=sep(24)),
            a("Grup Frekans", "4000", "50000", cost_currency="TRY", section="warmup"),
            sl("Bang Olufsen Ses Sistemi", "2000", "25000"),
            sl("LED Ekran 4x3 m", "2000", "18000"),
        ],
    )

    s.pay(gala, "LED Ekran 4x3 m", sep(25), "18000", account="İş Bankası")
    s.pay(gala, "Sahne Işık Paketi", sep(25), "7500", account="İş Bankası")
    s.expense(sep(25), "equipment", "Kablo ve mikrofon aksesuarları", "3200", account="Merkez Kasa")

    s.complete(cocktail, sep(26))
    s.collect(ktto, sep(26), "5000", "USD", account="Dolar Kasa", method="bank_transfer")
    with on(sep(26), 17):
        cash.transfer(
            db,
            transfer_date=sep(26),
            from_account_id=s.accounts["Merkez Kasa"].id,
            to_account_id=s.accounts["İş Bankası"].id,
            from_amount=D("50000"),
            to_amount=None,
            note="Kasadaki nakit bankaya yatırıldı",
            **s.acc,
        )

    s.collect(lords, sep(27), "3000", "GBP", partner="Volkan", doc="Elden")
    s.complete(lords, sep(28))
    s.pay(lords, "Asena", sep(28), "80000", partner="İbrahim")
    s.pay(lords, "Fuego Latino Dans Grubu", sep(28), "25000", account="İş Bankası")
    s.close(gala, sep(28), "Tahsilat tamam; ışık tedarikçisine kalan borç sonradan ödenecek.")

    with on(sep(29), 12):
        event_closing.write_off(
            db,
            db.get(Event, festival.id),
            "Belediye ses sistemindeki arıza gerekçesiyle hakedişten kesinti yaptı.",
            **s.kw,
        )
    s.close(festival, sep(29), "Kesinti sonrası kapatıldı.")
    s.partner_tx(
        "handover",
        "Volkan",
        sep(29),
        "2000",
        "GBP",
        "Sterlin Kasa",
        "Lord's Palace elden tahsilatın bir kısmı",
    )
    s.collect(cocktail, sep(29), "100000", account="İş Bankası", method="bank_transfer", doc="EFT")

    # 12) Kaya Düğünü — Ekim sonu, kapora alındı (operasyon hazırlığı sürüyor)
    kaya = s.agreement(
        sep(29),
        customer="Kaya Ailesi",
        partner="Alper",
        title="Kaya Düğün Organizasyonu",
        event_date=oct_(26),
        venue="Escape Beach",
        guests=350,
        advance="50000",
        lines=[
            a("Asena", "150000", "80000", at=(time(22, 0), time(23, 30))),
            a("Anatolia Dans Topluluğu", "45000", "30000", section="opening"),
            sl("Bang Olufsen Ses Sistemi", "40000", "25000"),
        ],
        notes="Kapora elden alındı.",
    )
    s.collect(kaya, sep(29), "50000", account="Merkez Kasa")

    s.pay(cocktail, "Bang Olufsen Ses Sistemi", sep(30), "25000", account="İş Bankası")
    s.pay(lords, "Sahne Işık Paketi", sep(30), "15000", account="İş Bankası")
    s.expense(sep(30), "office", "Telefon ve internet (Eylül)", "1450", account="İş Bankası")
    s.expense(
        sep(30),
        "tax_fees",
        "Muhasebe ücreti (Eylül)",
        "5000",
        paid_by="unpaid",
        supplier="Ercan Mali Müşavirlik",
    )
    s.partner_tx("payout", "Alper", sep(30), "30000", "TRY", "İş Bankası", "Eylül kâr payı avansı")
    s.partner_tx(
        "payout",
        "İbrahim",
        sep(30),
        "40000",
        "TRY",
        "İş Bankası",
        "Lord's Palace için cebinden ödediğinin bir kısmı",
    )

    # Vadesi geçmiş sanatçı borcu: Grup Frekans'a 5 Ekim'de ödenecekti
    with on(sep(30), 18):
        payables.update_payable(
            db, s.payable(cocktail, "Grup Frekans"), {"due_date": oct_(5)}, **s.acc
        )

    # --- Ekim (açık dönem) ---
    s.expense(oct_(1), "rent", "Ofis kirası (Ekim)", "18000", account="İş Bankası")
    s.collect(lords, oct_(5), "1000", "GBP", account="Sterlin Kasa", method="bank_transfer")
    with on(oct_(2), 10):
        offer = offers.create_offer(
            db,
            OfferCreate(
                customer_id=s.customer("Near East Bank").id,
                partner_id=s.partner["İbrahim"].id,
                title="Near East Bank Yılbaşı Kokteyli",
                event_date=date(2026, 12, 29),
                guest_count=200,
            ),
            **s.kw,
        )
        offers.add_line(db, offer, a("Grup Frekans", "95000"), **s.kw)
        offers.add_line(db, offer, sl("Bang Olufsen Ses Sistemi", "40000"), **s.kw)
        offers.change_status(db, offer, "send", None, **s.kw)
    with on(oct_(4), 10):
        draft = offers.create_offer(
            db,
            OfferCreate(
                customer_id=s.customer("Merit Park Hotel").id,
                partner_id=s.partner["Volkan"].id,
                title="Merit Park Yılbaşı Galası",
                event_date=date(2026, 12, 31),
                guest_count=400,
                currency="EUR",
                exchange_rate=rate_on("EUR", oct_(4)),
            ),
            **s.kw,
        )
        offers.add_line(
            db, draft, a("Sidar Karakuş", "4500", "2500", cost_currency="EUR", day=oct_(4)), **s.kw
        )

    # --- Operasyon kayıtları ---
    s.finish_operations(
        engagement, sep(7), 115, "Dans gösterisi çok beğenildi.", "Ses kontrolü 20 dk gecikti."
    )
    s.finish_operations(
        festival,
        sep(13),
        1700,
        "Kalabalık beklenenden fazlaydı, akış sorunsuz.",
        "Ses sisteminde 10 dakikalık arıza (belediye kesinti yaptı).",
    )
    s.finish_operations(wedding, sep(14), 410, "Gelin girişi ve dans gösterisi kusursuzdu.")
    s.finish_operations(gala, sep(20), 240, "Elena Rossi performansı ayakta alkışlandı.")
    s.finish_operations(birthday, sep(21), 85, "Küçük ama çok keyifli bir gece.")
    s.finish_operations(cocktail, sep(26), 150, "Kurumsal akış dakikası dakikasına uygulandı.")
    s.finish_operations(
        lords,
        sep(28),
        280,
        "Misafirler İngiliz; program İngilizce sunuldu.",
        "LED ekran tedarikçisi geç geldi.",
        submit=False,
    )
    seed_kaya_operations(s, kaya)


def seed_kaya_operations(s: Scenario, kaya: Event) -> None:
    db = s.db
    with on(oct_(5), 10):
        tasks = db.scalars(
            select(EventTask).where(EventTask.event_id == kaya.id).order_by(EventTask.sort_order)
        ).all()
        for task in tasks:
            task.assigned_to_id = s.crew.id
        operations.update_task(
            db,
            tasks[0],
            operations.TaskUpdate(status="done", note="Sahne ölçüleri alındı."),
            actor=s.crew,
        )
        operations.create_task(
            db,
            db.get(Event, kaya.id),
            operations.TaskCreate(
                title="Jeneratör kiralama teyidi",
                category="technical",
                assigned_to_id=s.crew.id,
                due_date=oct_(5),
            ),
        )
        checks = db.scalars(
            select(RiderCheck).where(RiderCheck.event_id == kaya.id).order_by(RiderCheck.id)
        ).all()
        for check, status, note in zip(
            checks,
            ["ok", "ok", "problem"],
            [None, None, "Mekânda ayrı kulis yok; çadır kurulacak."],
            strict=False,
        ):
            operations.update_rider_check(
                db,
                check,
                operations.RiderCheckUpdate(status=status, note=note),
                actor=s.crew,
                context=CTX,
            )


def seed_scenario(db: Session, users: dict[str, User], partner: dict[str, Partner]) -> None:
    s = Scenario(db, users, partner)
    seed_rates(db)
    seed_extras(s)
    seed_september(s)
