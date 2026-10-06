"""Demo iş verisi: müşteriler, mekânlar, tedarikçiler, sanatçılar, hizmetler, paketler.

Sadece `python -m app.cli seed-demo` tarafından, boş veritabanında çalıştırılır.
Kayıtlar normal servisler üzerinden oluşturulur; böylece arama metni ve işlem
geçmişi gerçek kullanımdaki gibi oluşur.
"""

from datetime import time
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.deps import RequestContext
from app.modules.catalog import service as catalog
from app.modules.catalog.schemas import (
    ArtistCreate,
    PackageCreate,
    PackageItemCreate,
    RiderItemCreate,
    ServiceCreate,
    SupplierCreate,
)
from app.modules.customers import service as customers
from app.modules.customers.schemas import ContactCreate, CustomerCreate, VenueCreate
from app.modules.partners.models import Partner
from app.modules.users.models import User

CTX = RequestContext(ip_address=None, user_agent="seed-demo")


def seed_business_data(db: Session, actor: User, partners: dict[str, Partner]) -> None:
    kw = {"actor": actor, "context": CTX}

    # --- Müşteriler ---
    kaya = customers.create_customer(
        db,
        CustomerCreate(
            customer_type="individual",
            name="Kaya Ailesi",
            phone="0533 111 22 33",
            city="Girne",
            default_invoice="without_invoice",
        ),
        **kw,
    )
    customers.create_contact(
        db, kaya, ContactCreate(full_name="Ayşe Kaya", phone="0533 111 22 33"), **kw
    )

    merit = customers.create_customer(
        db,
        CustomerCreate(
            customer_type="hotel",
            name="Merit Park Hotel",
            short_name="Merit Park",
            tax_number="MP-0045123",
            phone="0392 650 00 00",
            email="etkinlik@meritpark.example",
            city="Girne",
            district="Alsancak",
            default_invoice="with_invoice",
            default_currency="EUR",
            payment_term_days=30,
        ),
        **kw,
    )
    customers.create_contact(
        db,
        merit,
        ContactCreate(full_name="Selin Demir", title="Etkinlik Müdürü", phone="0533 444 55 66"),
        **kw,
    )
    customers.create_contact(
        db,
        merit,
        ContactCreate(full_name="Hakan Öz", title="Muhasebe", is_accounting=True),
        **kw,
    )
    customers.create_venue(
        db,
        VenueCreate(
            name="Merit Park Balo Salonu",
            venue_type="hall",
            customer_id=merit.id,
            city="Girne",
            capacity=800,
            technical_notes="Sahne 12x6 m, 3 faz elektrik mevcut.",
        ),
        **kw,
    )

    bank = customers.create_customer(
        db,
        CustomerCreate(
            customer_type="company",
            name="Near East Bank",
            tax_number="NEB-778812",
            phone="0392 444 00 00",
            city="Lefkoşa",
            default_invoice="with_invoice",
            payment_term_days=15,
            risk_level="watch",
            risk_note="Geçen yıl ödeme 3 hafta gecikti.",
        ),
        **kw,
    )
    customers.create_contact(
        db, bank, ContactCreate(full_name="Murat Aydın", title="Kurumsal İletişim"), **kw
    )

    customers.create_venue(
        db,
        VenueCreate(name="Escape Beach", venue_type="beach", city="Girne", capacity=1500),
        **kw,
    )

    # --- Tedarikçiler ---
    sound = catalog.create_supplier(
        db,
        SupplierCreate(
            name="Frekans Ses Işık Ltd.",
            contact_name="Cem Yalın",
            phone="0533 777 88 99",
            iban="TR12 0006 2000 0001 2345 6789 01",
        ),
        **kw,
    )
    screen = catalog.create_supplier(db, SupplierCreate(name="Pixel LED Ekran"), **kw)

    # --- Sanatçılar ---
    asena = catalog.create_artist(
        db,
        ArtistCreate(
            artist_type="solo",
            name="Asena",
            manager_partner_id=partners["Alper"].id,
            default_cost=Decimal("80000"),
            default_price=Decimal("120000"),
        ),
        **kw,
    )
    for order, (category, title) in enumerate(
        [
            ("technical", "2 adet kablosuz mikrofon (Shure)"),
            ("technical", "Sahnede 2 adet monitör"),
            ("backstage", "Ayna, ütü ve askılık bulunan özel kulis"),
            ("hospitality", "Oda sıcaklığında su ve meyve tabağı"),
        ],
        start=1,
    ):
        catalog.create_rider_item(
            db,
            asena,
            RiderItemCreate(category=category, title=title, sort_order=order * 10),
            **kw,
        )

    sidar = catalog.create_artist(
        db,
        ArtistCreate(
            artist_type="solo",
            name="Sidar Karakuş",
            manager_partner_id=partners["Volkan"].id,
            default_cost=Decimal("2500"),
            cost_currency="EUR",
            default_price=Decimal("4000"),
            price_currency="EUR",
        ),
        **kw,
    )
    frekans = catalog.create_artist(
        db,
        ArtistCreate(
            artist_type="band",
            name="Grup Frekans",
            manager_partner_id=partners["İbrahim"].id,
            default_cost=Decimal("50000"),
            default_price=Decimal("80000"),
        ),
        **kw,
    )
    catalog.create_artist(
        db,
        ArtistCreate(
            artist_type="dance_group", name="Anatolia Dans Topluluğu", default_cost=Decimal("30000")
        ),
        **kw,
    )

    # --- Hizmetler ---
    bo = catalog.create_service(
        db,
        ServiceCreate(
            service_type="sound",
            name="Bang Olufsen Ses Sistemi",
            unit="day",
            supplier_id=sound.id,
            default_cost=Decimal("25000"),
            default_price=Decimal("40000"),
        ),
        **kw,
    )
    catalog.create_service(
        db,
        ServiceCreate(
            service_type="light",
            name="Sahne Işık Paketi",
            unit="set",
            supplier_id=sound.id,
            default_cost=Decimal("15000"),
            default_price=Decimal("25000"),
        ),
        **kw,
    )
    led = catalog.create_service(
        db,
        ServiceCreate(
            service_type="screen",
            name="LED Ekran 4x3 m",
            unit="day",
            supplier_id=screen.id,
            default_cost=Decimal("18000"),
            default_price=Decimal("30000"),
        ),
        **kw,
    )

    # --- Paket (dokümandaki örnek) ---
    summer = catalog.create_package(
        db,
        PackageCreate(
            package_type="combo",
            name="Yaza Merhaba Paketi",
            description="Canlı müzik, DJ performansı ve tam teknik altyapı ile bir yaz gecesi.",
            price=Decimal("300000"),
        ),
        **kw,
    )
    for payload in [
        PackageItemCreate(component_type="service", service_id=bo.id, program_section="technical"),
        PackageItemCreate(component_type="service", service_id=led.id, program_section="technical"),
        PackageItemCreate(
            component_type="artist",
            artist_id=frekans.id,
            program_section="warmup",
            start_time=time(20, 30),
            end_time=time(21, 30),
        ),
        PackageItemCreate(
            component_type="artist",
            artist_id=asena.id,
            program_section="main",
            start_time=time(22, 0),
            end_time=time(23, 30),
        ),
        PackageItemCreate(
            component_type="artist",
            artist_id=sidar.id,
            program_section="closing",
            start_time=time(23, 45),
            end_time=time(1, 0),
        ),
    ]:
        catalog.create_package_item(db, summer, payload, **kw)
