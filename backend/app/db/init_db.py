from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import Base, SessionLocal, engine
from app.models import (  # noqa: F401
    Artist,
    ArtistRiderTemplateItem,
    AuditLog,
    CashAccount,
    CashTransfer,
    Collection,
    CurrencyRate,
    Customer,
    CustomerAccountMovement,
    CustomerContact,
    Document,
    Event,
    EventItem,
    EventProfitSnapshot,
    EventRiderCheck,
    Expense,
    ExpenseAllocation,
    MonthlyPartnerSummary,
    MonthlyPeriod,
    Offer,
    OfferItem,
    OperationNote,
    OperationTask,
    Partner,
    PartnerAccountMovement,
    PaymentPlan,
    ServiceItem,
    SystemSetting,
    User,
    UserRole,
    Venue,
)
from app.models.partner import Partner
from app.models.payment import CashAccount
from app.models.system import SystemSetting
from app.models.user import UserRole
from app.services.user_service import create_user, get_user_by_email


DEFAULT_PARTNERS = [
    "Ortak 1",
    "Ortak 2",
    "Ortak 3",
]


def create_all_tables(reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(bind=engine)

    Base.metadata.create_all(bind=engine)


def seed_admin_user(db: Session) -> None:
    existing_user = get_user_by_email(db=db, email=settings.admin_email)

    if existing_user is not None:
        print(f"Admin kullanÄ±cÄ±sÄ± zaten var: {settings.admin_email}")
        return

    create_user(
        db=db,
        full_name=settings.admin_full_name,
        email=settings.admin_email,
        password=settings.admin_password,
        role=UserRole.SUPER_ADMIN.value,
        is_active=True,
    )

    print(f"Admin kullanÄ±cÄ±sÄ± oluÅŸturuldu: {settings.admin_email}")


def seed_default_partners(db: Session) -> None:
    existing_count = db.query(Partner).count()

    if existing_count > 0:
        print("Ortak kayÄ±tlarÄ± zaten var.")
        return

    for partner_name in DEFAULT_PARTNERS:
        db.add(
            Partner(
                full_name=partner_name,
                ownership_percent=33.3333,
                is_active=True,
            )
        )

    db.commit()
    print("VarsayÄ±lan 3 ortak kaydÄ± oluÅŸturuldu.")


def seed_default_cash_accounts(db: Session) -> None:
    existing_count = db.query(CashAccount).count()

    if existing_count > 0:
        print("Kasa/banka hesaplarÄ± zaten var.")
        return

    db.add_all(
        [
            CashAccount(
                account_type="cash",
                name="Ana Kasa",
                currency="TRY",
                is_active=True,
            ),
            CashAccount(
                account_type="bank",
                name="Ana Banka HesabÄ±",
                currency="TRY",
                is_active=True,
            ),
        ]
    )

    db.commit()
    print("VarsayÄ±lan ana kasa ve banka hesabÄ± oluÅŸturuldu.")


def seed_system_settings(db: Session) -> None:
    defaults = {
        "base_currency": ("TRY", "Sistemin ana para birimi"),
        "vat_rate": ("16", "FaturalÄ± iÅŸlemlerde kullanÄ±lan KDV oranÄ±"),
        "partner_count": ("3", "Ortak sayÄ±sÄ±"),
    }

    for key, (value, description) in defaults.items():
        existing = db.query(SystemSetting).filter(SystemSetting.setting_key == key).first()

        if existing is None:
            db.add(
                SystemSetting(
                    setting_key=key,
                    setting_value=value,
                    setting_type="text",
                    description=description,
                )
            )

    db.commit()
    print("Sistem ayarlarÄ± kontrol edildi.")


def print_table_summary() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    print("")
    print("OluÅŸturulan tablo sayÄ±sÄ±:", len(table_names))

    for table_name in table_names:
        print(f"- {table_name}")


def main() -> None:
    print("VIA EVENTS veritabanÄ± hazÄ±rlanÄ±yor...")
    create_all_tables(reset=True)

    db = SessionLocal()

    try:
        seed_admin_user(db=db)
        seed_default_partners(db=db)
        seed_default_cash_accounts(db=db)
        seed_system_settings(db=db)
    finally:
        db.close()

    print_table_summary()
    print("")
    print("VeritabanÄ± hazÄ±r.")


if __name__ == "__main__":
    main()