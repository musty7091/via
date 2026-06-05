from __future__ import annotations

from datetime import date, datetime, timedelta, time

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.database import Base, SessionLocal, engine
from app.models import (  # noqa: F401
    Artist,
    ArtistRiderTemplateItem,
    CashAccount,
    CashTransfer,
    Collection,
    Customer,
    CustomerAccountMovement,
    CustomerContact,
    Event,
    EventItem,
    EventProfitSnapshot,
    EventRiderCheck,
    Expense,
    ExpenseAllocation,
    Offer,
    OfferItem,
    OperationNote,
    OperationTask,
    Partner,
    PartnerAccountMovement,
    PaymentPlan,
    ServiceItem,
    ServicePackage,
    ServicePackageItem,
    SystemSetting,
    User,
    UserRole,
    Venue,
)
from app.services.user_service import create_user, get_user_by_email

DEMO_PREFIX = "[DEMO]"
DEMO_EMAIL_DOMAIN = "viaevents.com"


def money(value: float) -> float:
    return round(float(value), 4)


def base_amount(amount: float, exchange_rate: float = 1) -> float:
    return money(float(amount) * float(exchange_rate or 1))


def commit_flush(db: Session):
    db.flush()


def ensure_admin_user(db: Session) -> User:
    admin = get_user_by_email(db=db, email=settings.admin_email)

    if admin is None:
        admin = create_user(
            db=db,
            full_name=settings.admin_full_name,
            email=settings.admin_email,
            password=settings.admin_password,
            role=UserRole.SUPER_ADMIN.value,
            is_active=True,
        )
        return admin

    admin.role = UserRole.SUPER_ADMIN.value
    admin.is_active = True
    admin.hashed_password = get_password_hash(settings.admin_password)
    db.flush()
    return admin


def upsert_demo_user(
    db: Session,
    full_name: str,
    email: str,
    password: str,
    role: str,
) -> User:
    user = get_user_by_email(db=db, email=email)

    if user is None:
        return create_user(
            db=db,
            full_name=full_name,
            email=email,
            password=password,
            role=role,
            is_active=True,
        )

    user.full_name = full_name
    user.role = role
    user.is_active = True
    user.hashed_password = get_password_hash(password)
    db.flush()
    return user


def id_list(query) -> list[int]:
    return [item.id for item in query.all()]


def delete_existing_demo_data(db: Session) -> None:
    demo_event_ids = id_list(
        db.query(Event).filter(
            or_(
                Event.event_code.like("DEMO-%"),
                Event.title.like(f"{DEMO_PREFIX}%"),
            )
        )
    )
    demo_offer_ids = id_list(
        db.query(Offer).filter(
            or_(
                Offer.offer_no.like("DEMO-%"),
                Offer.title.like(f"{DEMO_PREFIX}%"),
            )
        )
    )
    demo_package_ids = id_list(
        db.query(ServicePackage).filter(ServicePackage.name.like(f"{DEMO_PREFIX}%"))
    )
    demo_artist_ids = id_list(
        db.query(Artist).filter(Artist.name.like(f"{DEMO_PREFIX}%"))
    )
    demo_service_item_ids = id_list(
        db.query(ServiceItem).filter(ServiceItem.name.like(f"{DEMO_PREFIX}%"))
    )
    demo_customer_ids = id_list(
        db.query(Customer).filter(Customer.name.like(f"{DEMO_PREFIX}%"))
    )
    demo_partner_ids = id_list(
        db.query(Partner).filter(Partner.full_name.like(f"{DEMO_PREFIX}%"))
    )
    demo_user_ids = id_list(
        db.query(User).filter(User.email.like(f"demo.%@{DEMO_EMAIL_DOMAIN}"))
    )
    demo_cash_account_ids = id_list(
        db.query(CashAccount).filter(CashAccount.name.like(f"{DEMO_PREFIX}%"))
    )
    demo_payment_plan_ids = id_list(
        db.query(PaymentPlan).filter(PaymentPlan.event_id.in_(demo_event_ids or [-1]))
    )
    demo_collection_ids = id_list(
        db.query(Collection).filter(
            or_(
                Collection.event_id.in_(demo_event_ids or [-1]),
                Collection.customer_id.in_(demo_customer_ids or [-1]),
                Collection.received_by_partner_id.in_(demo_partner_ids or [-1]),
                Collection.received_by_user_id.in_(demo_user_ids or [-1]),
            )
        )
    )
    demo_expense_ids = id_list(
        db.query(Expense).filter(
            or_(
                Expense.event_id.in_(demo_event_ids or [-1]),
                Expense.artist_id.in_(demo_artist_ids or [-1]),
                Expense.paid_by_partner_id.in_(demo_partner_ids or [-1]),
                Expense.paid_by_user_id.in_(demo_user_ids or [-1]),
                Expense.title.like(f"{DEMO_PREFIX}%"),
            )
        )
    )

    db.query(CashTransfer).filter(
        or_(
            CashTransfer.collection_id.in_(demo_collection_ids or [-1]),
            CashTransfer.from_partner_id.in_(demo_partner_ids or [-1]),
            CashTransfer.from_user_id.in_(demo_user_ids or [-1]),
            CashTransfer.to_cash_account_id.in_(demo_cash_account_ids or [-1]),
            CashTransfer.document_no.like("DEMO-%"),
        )
    ).delete(synchronize_session=False)

    db.query(CustomerAccountMovement).filter(
        or_(
            CustomerAccountMovement.event_id.in_(demo_event_ids or [-1]),
            CustomerAccountMovement.collection_id.in_(demo_collection_ids or [-1]),
            CustomerAccountMovement.payment_plan_id.in_(demo_payment_plan_ids or [-1]),
            CustomerAccountMovement.customer_id.in_(demo_customer_ids or [-1]),
            CustomerAccountMovement.title.like(f"{DEMO_PREFIX}%"),
        )
    ).delete(synchronize_session=False)

    db.query(PartnerAccountMovement).filter(
        or_(
            PartnerAccountMovement.partner_id.in_(demo_partner_ids or [-1]),
            PartnerAccountMovement.event_id.in_(demo_event_ids or [-1]),
            PartnerAccountMovement.description.like(f"{DEMO_PREFIX}%"),
        )
    ).delete(synchronize_session=False)

    db.query(EventRiderCheck).filter(EventRiderCheck.event_id.in_(demo_event_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(OperationNote).filter(OperationNote.event_id.in_(demo_event_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(OperationTask).filter(OperationTask.event_id.in_(demo_event_ids or [-1])).delete(
        synchronize_session=False
    )

    db.query(ExpenseAllocation).filter(ExpenseAllocation.expense_id.in_(demo_expense_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(Expense).filter(Expense.id.in_(demo_expense_ids or [-1])).delete(
        synchronize_session=False
    )

    db.query(Collection).filter(Collection.id.in_(demo_collection_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(PaymentPlan).filter(PaymentPlan.id.in_(demo_payment_plan_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(EventProfitSnapshot).filter(EventProfitSnapshot.event_id.in_(demo_event_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(EventItem).filter(EventItem.event_id.in_(demo_event_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(OfferItem).filter(OfferItem.offer_id.in_(demo_offer_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(Offer).filter(Offer.id.in_(demo_offer_ids or [-1])).delete(
        synchronize_session=False
    )

    db.query(ServicePackageItem).filter(ServicePackageItem.package_id.in_(demo_package_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(ArtistRiderTemplateItem).filter(ArtistRiderTemplateItem.artist_id.in_(demo_artist_ids or [-1])).delete(
        synchronize_session=False
    )

    db.query(Venue).filter(
        or_(
            Venue.customer_id.in_(demo_customer_ids or [-1]),
            Venue.name.like(f"{DEMO_PREFIX}%"),
        )
    ).delete(synchronize_session=False)
    db.query(CustomerContact).filter(CustomerContact.customer_id.in_(demo_customer_ids or [-1])).delete(
        synchronize_session=False
    )

    db.query(Event).filter(Event.id.in_(demo_event_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(ServicePackage).filter(ServicePackage.id.in_(demo_package_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(ServiceItem).filter(ServiceItem.id.in_(demo_service_item_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(Artist).filter(Artist.id.in_(demo_artist_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(Customer).filter(Customer.id.in_(demo_customer_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(CashAccount).filter(CashAccount.id.in_(demo_cash_account_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(Partner).filter(Partner.id.in_(demo_partner_ids or [-1])).delete(
        synchronize_session=False
    )
    db.query(User).filter(User.id.in_(demo_user_ids or [-1])).delete(
        synchronize_session=False
    )

    db.commit()


def seed_users_and_partners(db: Session) -> dict[str, object]:
    admin = ensure_admin_user(db)

    accounting_user = upsert_demo_user(
        db=db,
        full_name="[DEMO] Ayşe Muhasebe",
        email="demo.accounting@viaevents.com",
        password="Demo12345!",
        role=UserRole.ACCOUNTING.value,
    )
    operation_user = upsert_demo_user(
        db=db,
        full_name="[DEMO] Murat Operasyon",
        email="demo.operation@viaevents.com",
        password="Demo12345!",
        role=UserRole.OPERATION.value,
    )
    viewer_user = upsert_demo_user(
        db=db,
        full_name="[DEMO] Demo İzleyici",
        email="demo.viewer@viaevents.com",
        password="Demo12345!",
        role=UserRole.VIEWER.value,
    )
    partner_user = upsert_demo_user(
        db=db,
        full_name="[DEMO] Alper Yönetici",
        email="demo.partner@viaevents.com",
        password="Demo12345!",
        role=UserRole.PARTNER_MANAGER.value,
    )

    partners = [
        Partner(
            user_id=admin.id,
            full_name="[DEMO] Mustafa Karadeniz",
            ownership_percent=33.3333,
            is_active=True,
            notes="[DEMO] Kurucu ortak / finans kontrol",
        ),
        Partner(
            user_id=partner_user.id,
            full_name="[DEMO] Alper Demir",
            ownership_percent=33.3333,
            is_active=True,
            notes="[DEMO] Saha ve tahsilat sorumlusu",
        ),
        Partner(
            user_id=None,
            full_name="[DEMO] Ece Yıldırım",
            ownership_percent=33.3334,
            is_active=True,
            notes="[DEMO] Operasyon ortağı",
        ),
    ]
    db.add_all(partners)
    db.flush()

    return {
        "admin": admin,
        "accounting_user": accounting_user,
        "operation_user": operation_user,
        "viewer_user": viewer_user,
        "partner_user": partner_user,
        "partners": partners,
    }


def seed_cash_accounts(db: Session) -> dict[str, CashAccount]:
    cash = CashAccount(
        account_type="cash",
        name="[DEMO] Etkinlik Kasası",
        currency="TRY",
        is_active=True,
        notes="[DEMO] Nakit tahsilatlar için demo kasa",
    )
    bank = CashAccount(
        account_type="bank",
        name="[DEMO] VIA Banka Hesabı",
        currency="TRY",
        is_active=True,
        notes="[DEMO] Banka tahsilatları için demo hesap",
    )
    db.add_all([cash, bank])
    db.flush()
    return {"cash": cash, "bank": bank}


def seed_customers(db: Session) -> dict[str, object]:
    customer_specs = [
        {
            "key": "kaya",
            "name": "[DEMO] Kaya Wedding & Events",
            "short_name": "Kaya Wedding",
            "customer_type": "person",
            "phone": "0533 111 22 33",
            "email": "kaya.wedding.demo@viaevents.com",
            "city": "Girne",
            "district": "Çatalköy",
            "address": "Demo düğün müşterisi adresi",
            "risk_level": "normal",
            "venue": "[DEMO] Kaya Artemis Ballroom",
            "venue_type": "hotel_ballroom",
            "capacity": 600,
            "contact": "Deniz Kaya",
        },
        {
            "key": "arkin",
            "name": "[DEMO] Arkın Group Corporate",
            "short_name": "Arkın Group",
            "customer_type": "company",
            "phone": "0392 444 00 01",
            "email": "events@arkingroup.demo",
            "city": "Lefkoşa",
            "district": "Merkez",
            "address": "Demo kurumsal müşteri adresi",
            "risk_level": "low",
            "venue": "[DEMO] Harbour Expo Hall",
            "venue_type": "corporate_hall",
            "capacity": 1000,
            "contact": "Selin Arkın",
        },
        {
            "key": "bellapais",
            "name": "[DEMO] Bellapais Garden Wedding",
            "short_name": "Bellapais Garden",
            "customer_type": "company",
            "phone": "0392 815 20 20",
            "email": "info@bellapais.demo",
            "city": "Girne",
            "district": "Bellapais",
            "address": "Demo açık hava etkinlik alanı",
            "risk_level": "normal",
            "venue": "[DEMO] Bellapais Garden",
            "venue_type": "outdoor",
            "capacity": 350,
            "contact": "Eylül Hanım",
        },
        {
            "key": "mediterra",
            "name": "[DEMO] Mediterra Hotel Events",
            "short_name": "Mediterra",
            "customer_type": "company",
            "phone": "0392 600 10 10",
            "email": "sales@mediterra.demo",
            "city": "Gazimağusa",
            "district": "Merkez",
            "address": "Demo otel etkinlik adresi",
            "risk_level": "normal",
            "venue": "[DEMO] Mediterra Ballroom",
            "venue_type": "hotel_ballroom",
            "capacity": 450,
            "contact": "Melis Turan",
        },
    ]

    customers: dict[str, Customer] = {}
    venues: dict[str, Venue] = {}

    for spec in customer_specs:
        customer = Customer(
            customer_type=spec["customer_type"],
            customer_status="active",
            name=spec["name"],
            short_name=spec["short_name"],
            tax_number=None,
            tax_office=None,
            phone=spec["phone"],
            email=spec["email"],
            website=None,
            country="KKTC",
            city=spec["city"],
            district=spec["district"],
            address=spec["address"],
            default_invoice_type="without_invoice",
            default_currency="TRY",
            default_payment_term_days=7,
            risk_level=spec["risk_level"],
            risk_note="[DEMO] Demo risk notu",
            is_active=True,
            notes="[DEMO] Demo müşteri kaydı",
        )
        db.add(customer)
        db.flush()

        contact = CustomerContact(
            customer_id=customer.id,
            full_name=f"[DEMO] {spec['contact']}",
            title="Etkinlik Yetkilisi",
            contact_role="event_owner",
            phone=spec["phone"],
            whatsapp_phone=spec["phone"],
            email=spec["email"],
            is_primary_contact=True,
            is_accounting_contact=True,
            is_operation_contact=True,
            is_active=True,
            notes="[DEMO] Demo yetkili kişi",
        )
        db.add(contact)

        venue = Venue(
            customer_id=customer.id,
            name=spec["venue"],
            venue_type=spec["venue_type"],
            country="KKTC",
            city=spec["city"],
            district=spec["district"],
            address=spec["address"],
            contact_name=spec["contact"],
            contact_phone=spec["phone"],
            contact_email=spec["email"],
            capacity=spec["capacity"],
            stage_info="8x6 metre sahne alanı, backstage erişimi mevcut.",
            technical_notes="Elektrik ve yükleme alanı etkinlik öncesi kontrol edilecek.",
            notes="[DEMO] Demo mekan kaydı",
            is_active=True,
        )
        db.add(venue)
        db.flush()

        customers[spec["key"]] = customer
        venues[spec["key"]] = venue

    db.flush()
    return {"customers": customers, "venues": venues}


def seed_catalog(db: Session, partners: list[Partner]) -> dict[str, object]:
    partner = partners[1]

    artist_specs = [
        ("sidar", "[DEMO] Sidar Karakuş", "artist", 45000, 70000),
        ("frekans", "[DEMO] Grup Frekans", "band", 80000, 120000),
        ("asena", "[DEMO] Asena", "show", 70000, 110000),
        ("dj", "[DEMO] DJ Arven", "dj", 25000, 45000),
        ("reva", "[DEMO] Reva Acoustic", "acoustic", 30000, 50000),
        ("nafiz", "[DEMO] Nafiz Dölek", "artist", 35000, 60000),
    ]

    artists: dict[str, Artist] = {}

    for key, name, artist_type, cost, sale in artist_specs:
        artist = Artist(
            artist_type=artist_type,
            name=name,
            manager_partner_id=partner.id,
            default_cost_amount=cost,
            default_cost_currency="TRY",
            default_sale_amount=sale,
            default_sale_currency="TRY",
            notes="[DEMO] Demo sanatçı kartı",
            is_active=True,
        )
        db.add(artist)
        db.flush()
        artists[key] = artist

        rider_items = [
            ("Sahne ölçüsü", "Minimum 8x6 metre sahne alanı.", "stage"),
            ("Ses sistemi", "Profesyonel line-array veya eşdeğer sistem.", "sound"),
            ("Backstage", "Sanatçı ekibi için kapalı backstage alanı.", "backstage"),
            ("Ulaşım", "Etkinlik saatinden en az 2 saat önce ulaşım.", "logistics"),
        ]

        for order, (title, description, category) in enumerate(rider_items, start=1):
            db.add(
                ArtistRiderTemplateItem(
                    artist_id=artist.id,
                    title=title,
                    description=description,
                    category=category,
                    sort_order=order,
                    is_required=True,
                    is_active=True,
                )
            )

    service_specs = [
        ("bo", "[DEMO] B&O Ses Sistemi", "technical", 30000, 55000),
        ("light", "[DEMO] Işık Sistemi", "technical", 22000, 38000),
        ("led", "[DEMO] LED Ekran", "technical", 40000, 70000),
        ("stage", "[DEMO] Sahne Kurulumu", "operation", 18000, 30000),
        ("tech_team", "[DEMO] Teknik Ekip", "operation", 15000, 25000),
        ("transport", "[DEMO] Ulaşım", "logistics", 8000, 15000),
        ("hotel", "[DEMO] Konaklama", "logistics", 12000, 20000),
        ("catering", "[DEMO] Backstage Catering", "operation", 6000, 12000),
    ]

    services: dict[str, ServiceItem] = {}

    for key, name, service_type, cost, sale in service_specs:
        service = ServiceItem(
            service_type=service_type,
            name=name,
            default_cost_amount=cost,
            default_cost_currency="TRY",
            default_sale_amount=sale,
            default_sale_currency="TRY",
            notes="[DEMO] Demo hizmet kartı",
            is_active=True,
        )
        db.add(service)
        db.flush()
        services[key] = service

    packages: dict[str, ServicePackage] = {}

    def create_package(
        key: str,
        name: str,
        sale_amount: float,
        description: str,
        items: list[dict[str, object]],
    ) -> ServicePackage:
        package = ServicePackage(
            package_type="combo",
            name=name,
            description=description,
            default_sale_amount=sale_amount,
            default_sale_currency="TRY",
            notes="[DEMO] Demo kombo paket. Müşteri teklifi tek paket fiyatı görür.",
            is_active=True,
        )
        db.add(package)
        db.flush()
        packages[key] = package

        for order, item in enumerate(items, start=1):
            artist = artists.get(item.get("artist_key")) if item.get("artist_key") else None
            service = services.get(item.get("service_key")) if item.get("service_key") else None
            cost = float(item["cost"])
            item_title = str(item["title"])

            db.add(
                ServicePackageItem(
                    package_id=package.id,
                    component_type=str(item["type"]),
                    artist_id=artist.id if artist else None,
                    service_item_id=service.id if service else None,
                    title=item_title,
                    program_section=str(item.get("section") or "Program"),
                    sort_order=order,
                    start_time=item.get("start_time"),
                    end_time=item.get("end_time"),
                    quantity=1,
                    unit_cost_amount=cost,
                    unit_cost_currency="TRY",
                    unit_sale_amount=0,
                    unit_sale_currency="TRY",
                    total_cost_amount=cost,
                    total_sale_amount=0,
                    is_optional=False,
                    is_visible_on_offer=True,
                    is_active=True,
                    notes="[DEMO] Paket iç bileşeni. Satış fiyatı paket ana satırından gelir.",
                )
            )

        return package

    create_package(
        key="premium_wedding",
        name="[DEMO] Premium Wedding Package",
        sale_amount=300000,
        description="Düğün gecesi için sanatçı, orkestra, ses ve after party paketi.",
        items=[
            {"title": "Açılış Show - Asena", "type": "artist", "artist_key": "asena", "cost": 70000, "section": "Show", "start_time": time(21, 0), "end_time": time(21, 30)},
            {"title": "Ana Sahne - Grup Frekans", "type": "artist", "artist_key": "frekans", "cost": 80000, "section": "Ana Program", "start_time": time(21, 45), "end_time": time(23, 15)},
            {"title": "B&O Ses Sistemi", "type": "service", "service_key": "bo", "cost": 30000, "section": "Teknik"},
            {"title": "After Party - DJ Arven", "type": "artist", "artist_key": "dj", "cost": 25000, "section": "After Party", "start_time": time(23, 30), "end_time": time(1, 0)},
            {"title": "Backstage Catering", "type": "service", "service_key": "catering", "cost": 6000, "section": "Operasyon"},
        ],
    )

    create_package(
        key="corporate_launch",
        name="[DEMO] Corporate Launch Package",
        sale_amount=185000,
        description="Kurumsal lansman ve marka gecesi için konuşma, teknik ve müzik paketi.",
        items=[
            {"title": "LED Ekran", "type": "service", "service_key": "led", "cost": 40000, "section": "Teknik"},
            {"title": "Işık Sistemi", "type": "service", "service_key": "light", "cost": 22000, "section": "Teknik"},
            {"title": "Sahne Kurulumu", "type": "service", "service_key": "stage", "cost": 18000, "section": "Teknik"},
            {"title": "Kapanış Müzik - DJ Arven", "type": "artist", "artist_key": "dj", "cost": 25000, "section": "Kapanış"},
        ],
    )

    create_package(
        key="acoustic_dinner",
        name="[DEMO] Acoustic Dinner Package",
        sale_amount=95000,
        description="Restoran ve otel akşam yemekleri için sade akustik müzik paketi.",
        items=[
            {"title": "Reva Acoustic", "type": "artist", "artist_key": "reva", "cost": 30000, "section": "Dinner Music"},
            {"title": "Küçük Ses Sistemi", "type": "service", "service_key": "bo", "cost": 18000, "section": "Teknik"},
            {"title": "Ulaşım", "type": "service", "service_key": "transport", "cost": 8000, "section": "Lojistik"},
        ],
    )

    create_package(
        key="full_night",
        name="[DEMO] Full Night Entertainment Package",
        sale_amount=420000,
        description="Büyük ölçekli gala ve festival tipi gece eğlence paketi.",
        items=[
            {"title": "Sidar Karakuş", "type": "artist", "artist_key": "sidar", "cost": 45000, "section": "Warm Up"},
            {"title": "Grup Frekans", "type": "artist", "artist_key": "frekans", "cost": 80000, "section": "Ana Sahne"},
            {"title": "Nafiz Dölek", "type": "artist", "artist_key": "nafiz", "cost": 35000, "section": "Konuk Sanatçı"},
            {"title": "LED Ekran", "type": "service", "service_key": "led", "cost": 40000, "section": "Teknik"},
            {"title": "B&O Ses Sistemi", "type": "service", "service_key": "bo", "cost": 30000, "section": "Teknik"},
            {"title": "Işık Sistemi", "type": "service", "service_key": "light", "cost": 22000, "section": "Teknik"},
        ],
    )

    db.flush()
    return {"artists": artists, "services": services, "packages": packages}


def add_offer_item_for_package(
    db: Session,
    offer: Offer,
    package: ServicePackage,
):
    item = OfferItem(
        offer_id=offer.id,
        source_type="package",
        source_package_item_id=None,
        artist_id=None,
        service_item_id=None,
        title=package.name.replace(DEMO_PREFIX + " ", ""),
        description=package.description or package.name,
        program_section="Paket",
        start_time=None,
        end_time=None,
        quantity=1,
        unit_price=package.default_sale_amount,
        currency=package.default_sale_currency,
        base_amount=base_amount(package.default_sale_amount, 1),
        internal_unit_cost=0,
        internal_cost_currency="TRY",
        internal_total_cost=0,
        is_visible_on_offer=True,
        is_active=True,
        sort_order=1,
    )
    db.add(item)


def add_event_items_from_package(
    db: Session,
    event: Event,
    package: ServicePackage,
):
    package_items = (
        db.query(ServicePackageItem)
        .filter(ServicePackageItem.package_id == package.id)
        .order_by(ServicePackageItem.sort_order.asc())
        .all()
    )

    for package_item in package_items:
        db.add(
            EventItem(
                event_id=event.id,
                item_type=package_item.component_type,
                artist_id=package_item.artist_id,
                service_item_id=package_item.service_item_id,
                description=package_item.title,
                sale_amount=0,
                sale_currency=package_item.unit_sale_currency,
                cost_amount=package_item.total_cost_amount,
                cost_currency=package_item.unit_cost_currency,
                exchange_rate=1,
                base_sale_amount=0,
                base_cost_amount=package_item.total_cost_amount,
                sort_order=package_item.sort_order,
            )
        )


def seed_sales_and_events(
    db: Session,
    customers: dict[str, Customer],
    venues: dict[str, Venue],
    packages: dict[str, ServicePackage],
    users: dict[str, object],
) -> None:
    today = date.today()
    admin: User = users["admin"]
    accounting_user: User = users["accounting_user"]
    operation_user: User = users["operation_user"]
    partners: list[Partner] = users["partners"]

    scenarios = [
        {
            "key": "kaya",
            "offer_no": "DEMO-TEK-2026-001",
            "event_code": "DEMO-EVT-2026-001",
            "title": "[DEMO] Kaya Wedding Summer Night",
            "customer": customers["kaya"],
            "venue": venues["kaya"],
            "package": packages["premium_wedding"],
            "event_date": today + timedelta(days=21),
            "offer_status": "agreement",
            "event_status": "preparation",
            "advance": 50000,
            "plans": [
                ("Kapora", today - timedelta(days=2), 100000),
                ("Ara Ödeme", today + timedelta(days=10), 100000),
                ("Kalan Ödeme", today + timedelta(days=20), 100000),
            ],
            "collections": [
                ("Kapora", today - timedelta(days=1), 50000, partners[1].id, "cash", "DEMO-TAH-001"),
            ],
            "expenses": [
                ("Sanatçı ön ödeme", 60000, partners[0].id),
                ("Teknik ekip avans", 15000, None),
            ],
            "tasks": [
                ("Rider kontrolü", "operation", "pending"),
                ("Sahne keşfi", "technical", "in_progress"),
                ("Kapora hatırlatma", "finance", "completed"),
            ],
        },
        {
            "key": "arkin",
            "offer_no": "DEMO-TEK-2026-002",
            "event_code": "DEMO-EVT-2026-002",
            "title": "[DEMO] Arkın Group Corporate Launch",
            "customer": customers["arkin"],
            "venue": venues["arkin"],
            "package": packages["corporate_launch"],
            "event_date": today - timedelta(days=12),
            "offer_status": "agreement",
            "event_status": "completed",
            "advance": 185000,
            "plans": [
                ("Tek ödeme", today - timedelta(days=20), 185000),
            ],
            "collections": [
                ("Tek ödeme", today - timedelta(days=19), 185000, None, "bank", "DEMO-BNK-001"),
            ],
            "expenses": [
                ("LED ekran tedarikçi ödemesi", 40000, None),
                ("Teknik ekip ödemesi", 25000, None),
            ],
            "tasks": [
                ("Kurulum tamamlandı", "technical", "completed"),
                ("Müşteri kapanış görüşmesi", "sales", "completed"),
            ],
        },
        {
            "key": "bellapais",
            "offer_no": "DEMO-TEK-2026-003",
            "event_code": "DEMO-EVT-2026-003",
            "title": "[DEMO] Bellapais Acoustic Dinner",
            "customer": customers["bellapais"],
            "venue": venues["bellapais"],
            "package": packages["acoustic_dinner"],
            "event_date": today + timedelta(days=6),
            "offer_status": "agreement",
            "event_status": "planned",
            "advance": 0,
            "plans": [
                ("Kapora", today + timedelta(days=1), 35000),
                ("Etkinlik günü kalan", today + timedelta(days=6), 60000),
            ],
            "collections": [],
            "expenses": [
                ("Ulaşım rezervasyonu", 8000, partners[2].id),
            ],
            "tasks": [
                ("Akustik ekip teyidi", "operation", "pending"),
                ("Mekân teknik teyidi", "technical", "pending"),
            ],
        },
    ]

    for scenario in scenarios:
        package = scenario["package"]
        total_amount = money(package.default_sale_amount)
        offer = Offer(
            event_id=None,
            customer_id=scenario["customer"].id,
            venue_id=scenario["venue"].id,
            package_id=package.id,
            offer_no=scenario["offer_no"],
            title=scenario["title"],
            status=scenario["offer_status"],
            offer_date=today - timedelta(days=15),
            event_date=scenario["event_date"],
            valid_until=today + timedelta(days=10),
            invoice_type="without_invoice",
            vat_rate=0,
            amount=total_amount,
            currency="TRY",
            exchange_rate=1,
            base_amount=total_amount,
            vat_amount=0,
            total_amount=total_amount,
            advance_payment_amount=scenario["advance"],
            advance_payment_currency="TRY",
            payment_terms="Kapora ve kalan ödeme etkinlik tarihine göre planlanır.",
            customer_visible_notes="Demo teklif müşteri notu. Paket tek fiyat olarak sunulur.",
            internal_notes="[DEMO] İç maliyetler müşteri çıktısında gösterilmez.",
            agreement_notes="[DEMO] Demo anlaşma notu.",
            notes="[DEMO] Demo teklif kaydı.",
        )
        db.add(offer)
        db.flush()
        add_offer_item_for_package(db=db, offer=offer, package=package)

        event = Event(
            event_code=scenario["event_code"],
            title=scenario["title"],
            customer_id=scenario["customer"].id,
            venue_id=scenario["venue"].id,
            responsible_partner_id=partners[1].id,
            operation_user_id=operation_user.id,
            event_date=scenario["event_date"],
            start_datetime=None,
            end_datetime=None,
            status=scenario["event_status"],
            invoice_type="without_invoice",
            vat_rate=0,
            agreement_amount=total_amount,
            agreement_currency="TRY",
            exchange_rate=1,
            base_agreement_amount=total_amount,
            vat_amount=0,
            total_customer_amount=total_amount,
            notes="[DEMO] Anlaşmadan oluşan demo etkinlik dosyası.",
            is_period_closed=False,
        )
        db.add(event)
        db.flush()

        offer.event_id = event.id
        add_event_items_from_package(db=db, event=event, package=package)

        plan_map: dict[str, PaymentPlan] = {}

        for title, due_date, amount in scenario["plans"]:
            plan = PaymentPlan(
                event_id=event.id,
                title=title,
                due_date=due_date,
                amount=amount,
                currency="TRY",
                exchange_rate=1,
                base_amount=amount,
                paid_base_amount=0,
                status="pending",
                notes="[DEMO] Demo ödeme planı satırı.",
            )
            db.add(plan)
            db.flush()
            plan_map[title] = plan

            db.add(
                CustomerAccountMovement(
                    customer_id=scenario["customer"].id,
                    event_id=event.id,
                    collection_id=None,
                    payment_plan_id=plan.id,
                    movement_date=due_date,
                    movement_type="payment_plan",
                    direction="debit",
                    title=f"{DEMO_PREFIX} {title} ödeme planı",
                    description=f"{scenario['title']} ödeme planı",
                    detail_note="[DEMO] Planlanan ödeme hareketi.",
                    amount=amount,
                    currency="TRY",
                    exchange_rate=1,
                    base_amount=amount,
                    payment_method=None,
                    collected_by_partner_id=None,
                    created_by_user_id=admin.id,
                    document_no=None,
                    reference_type="payment_plan",
                    reference_id=plan.id,
                    is_cancelled=False,
                    cancellation_reason=None,
                    notes="[DEMO] Cari plan hareketi",
                )
            )

        for plan_title, collection_date, amount, partner_id, method, document_no in scenario["collections"]:
            plan = plan_map.get(plan_title)
            collection = Collection(
                event_id=event.id,
                payment_plan_id=plan.id if plan else None,
                customer_id=scenario["customer"].id,
                received_by_user_id=accounting_user.id,
                received_by_partner_id=partner_id,
                collection_date=collection_date,
                amount=amount,
                currency="TRY",
                exchange_rate=1,
                base_amount=amount,
                payment_method=method,
                current_location="with_partner" if partner_id else "company",
                is_transferred_to_company=False,
                transferred_at=None,
                document_no=document_no,
                notes="[DEMO] Demo tahsilat kaydı.",
                is_cancelled=False,
                cancellation_reason=None,
            )
            db.add(collection)
            db.flush()

            if plan is not None:
                plan.paid_base_amount = money(plan.paid_base_amount + amount)
                if plan.paid_base_amount >= plan.base_amount:
                    plan.status = "paid"
                elif plan.paid_base_amount > 0:
                    plan.status = "partial"

            db.add(
                CustomerAccountMovement(
                    customer_id=scenario["customer"].id,
                    event_id=event.id,
                    collection_id=collection.id,
                    payment_plan_id=plan.id if plan else None,
                    movement_date=collection_date,
                    movement_type="collection",
                    direction="credit",
                    title=f"{DEMO_PREFIX} Tahsilat",
                    description=f"{scenario['title']} tahsilatı",
                    detail_note="[DEMO] Gerçekleşen tahsilat hareketi.",
                    amount=amount,
                    currency="TRY",
                    exchange_rate=1,
                    base_amount=amount,
                    payment_method=method,
                    collected_by_partner_id=partner_id,
                    created_by_user_id=accounting_user.id,
                    document_no=document_no,
                    reference_type="collection",
                    reference_id=collection.id,
                    is_cancelled=False,
                    cancellation_reason=None,
                    notes="[DEMO] Cari tahsilat hareketi",
                )
            )

        for title, amount, paid_by_partner_id in scenario["expenses"]:
            expense = Expense(
                expense_type="event",
                event_id=event.id,
                artist_id=None,
                paid_by_partner_id=paid_by_partner_id,
                paid_by_user_id=accounting_user.id,
                title=f"{DEMO_PREFIX} {title}",
                description="[DEMO] Demo etkinlik gideri.",
                expense_date=scenario["event_date"] - timedelta(days=2),
                amount=amount,
                currency="TRY",
                exchange_rate=1,
                base_amount=amount,
                is_allocated=False,
                allocation_start_month=None,
                allocation_end_month=None,
                status="approved",
                document_no=f"DEMO-GID-{event.id}-{int(amount)}",
                is_cancelled=False,
                cancellation_reason=None,
            )
            db.add(expense)

        for order, (title, category, status) in enumerate(scenario["tasks"], start=1):
            db.add(
                OperationTask(
                    event_id=event.id,
                    assigned_to_user_id=operation_user.id,
                    title=f"{DEMO_PREFIX} {title}",
                    description="[DEMO] Demo operasyon görevi.",
                    category=category,
                    status=status,
                    due_datetime=datetime.combine(scenario["event_date"], time(12, 0)),
                    completed_at=datetime.combine(today, time(15, 0)) if status == "completed" else None,
                    sort_order=order,
                    is_required=True,
                )
            )

        db.add(
            OperationNote(
                event_id=event.id,
                user_id=operation_user.id,
                note_type="general",
                note="[DEMO] Demo operasyon notu: Müşteri program akışı ve teknik ihtiyaçlar teyit edilecek.",
            )
        )

        artist_ids_for_event = [
            item.artist_id
            for item in db.query(EventItem).filter(EventItem.event_id == event.id).all()
            if item.artist_id is not None
        ]
        for order, artist_id in enumerate(artist_ids_for_event[:3], start=1):
            db.add(
                EventRiderCheck(
                    event_id=event.id,
                    artist_id=artist_id,
                    template_item_id=None,
                    checked_by_user_id=operation_user.id if order == 1 else None,
                    title=f"{DEMO_PREFIX} Rider kontrol {order}",
                    description="[DEMO] Sanatçı rider maddesi kontrol edilecek.",
                    status="done" if order == 1 else "pending",
                    checked_at=datetime.now() if order == 1 else None,
                    problem_note=None,
                    sort_order=order,
                    is_required=True,
                )
            )

        revenue = total_amount
        costs = sum(float(item.base_cost_amount) for item in db.query(EventItem).filter(EventItem.event_id == event.id).all())
        expenses = sum(float(exp.amount) for exp in db.query(Expense).filter(Expense.event_id == event.id).all())
        db.add(
            EventProfitSnapshot(
                event_id=event.id,
                revenue_base_amount=revenue,
                artist_cost_base_amount=costs,
                operation_expense_base_amount=expenses,
                other_expense_base_amount=0,
                net_profit_base_amount=revenue - costs - expenses,
                partner_share_base_amount=(revenue - costs - expenses) / 3,
                calculated_at=datetime.now(),
                notes="[DEMO] Demo kârlılık snapshot kaydı.",
            )
        )

    cancelled_offer = Offer(
        event_id=None,
        customer_id=customers["mediterra"].id,
        venue_id=venues["mediterra"].id,
        package_id=packages["full_night"].id,
        offer_no="DEMO-TEK-2026-004",
        title="[DEMO] Mediterra Full Night Gala",
        status="cancelled",
        offer_date=today - timedelta(days=5),
        event_date=today + timedelta(days=45),
        valid_until=today + timedelta(days=5),
        invoice_type="without_invoice",
        vat_rate=0,
        amount=packages["full_night"].default_sale_amount,
        currency="TRY",
        exchange_rate=1,
        base_amount=packages["full_night"].default_sale_amount,
        vat_amount=0,
        total_amount=packages["full_night"].default_sale_amount,
        advance_payment_amount=0,
        advance_payment_currency="TRY",
        payment_terms="İptal edilmiş demo teklif.",
        customer_visible_notes="Demo iptal teklif.",
        internal_notes="[DEMO] İptal edilmiş demo teklif.",
        agreement_notes=None,
        notes="[DEMO] İptal demo teklif.",
    )
    db.add(cancelled_offer)
    db.flush()
    add_offer_item_for_package(db=db, offer=cancelled_offer, package=packages["full_night"])


def seed_system_settings(db: Session) -> None:
    settings_to_upsert = {
        "demo_seed_version": ("v1", "Demo seed paketi versiyonu"),
        "demo_seed_last_run": (datetime.now().isoformat(timespec="seconds"), "Demo seed son çalışma zamanı"),
    }

    for key, (value, description) in settings_to_upsert.items():
        setting = db.query(SystemSetting).filter(SystemSetting.setting_key == key).first()

        if setting is None:
            db.add(
                SystemSetting(
                    setting_key=key,
                    setting_value=value,
                    setting_type="text",
                    description=description,
                )
            )
        else:
            setting.setting_value = value
            setting.description = description

    db.flush()


def print_summary(db: Session) -> None:
    print("")
    print("Demo seed özeti:")
    print("- Demo müşteriler:", db.query(Customer).filter(Customer.name.like(f"{DEMO_PREFIX}%")).count())
    print("- Demo mekanlar:", db.query(Venue).filter(Venue.name.like(f"{DEMO_PREFIX}%")).count())
    print("- Demo sanatçılar:", db.query(Artist).filter(Artist.name.like(f"{DEMO_PREFIX}%")).count())
    print("- Demo hizmetler:", db.query(ServiceItem).filter(ServiceItem.name.like(f"{DEMO_PREFIX}%")).count())
    print("- Demo paketler:", db.query(ServicePackage).filter(ServicePackage.name.like(f"{DEMO_PREFIX}%")).count())
    print("- Demo teklifler:", db.query(Offer).filter(Offer.offer_no.like("DEMO-%")).count())
    print("- Demo etkinlikler:", db.query(Event).filter(Event.event_code.like("DEMO-%")).count())
    print("- Demo ödeme planları:", db.query(PaymentPlan).filter(PaymentPlan.event_id.in_(id_list(db.query(Event).filter(Event.event_code.like("DEMO-%"))) or [-1])).count())
    print("- Demo tahsilatlar:", db.query(Collection).filter(Collection.event_id.in_(id_list(db.query(Event).filter(Event.event_code.like("DEMO-%"))) or [-1])).count())
    print("- Demo giderler:", db.query(Expense).filter(Expense.title.like(f"{DEMO_PREFIX}%")).count())
    print("")
    print("Demo kullanıcıları:")
    print("- demo.accounting@viaevents.com / Demo12345!")
    print("- demo.operation@viaevents.com / Demo12345!")
    print("- demo.partner@viaevents.com / Demo12345!")
    print("- demo.viewer@viaevents.com / Demo12345!")


def main() -> None:
    print("VIA EVENTS Demo Seed Paketi v1 çalışıyor...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        delete_existing_demo_data(db=db)
        users = seed_users_and_partners(db=db)
        seed_cash_accounts(db=db)
        customer_result = seed_customers(db=db)
        catalog_result = seed_catalog(db=db, partners=users["partners"])
        seed_sales_and_events(
            db=db,
            customers=customer_result["customers"],
            venues=customer_result["venues"],
            packages=catalog_result["packages"],
            users=users,
        )
        seed_system_settings(db=db)
        db.commit()
        print_summary(db=db)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print("")
    print("Demo seed hazır.")


if __name__ == "__main__":
    main()
