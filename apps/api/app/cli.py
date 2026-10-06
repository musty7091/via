"""Komut satırı araçları.

Kullanım (apps/api klasöründe):
    python -m app.cli create-admin --name "Mustafa Karadeniz" --email mustafa@viaevents.com
    python -m app.cli seed-demo --password "DemoSifre2026!"
    python -m app.cli seed-demo --password "DemoSifre2026!" --reset   # önce her şeyi siler
"""

import argparse
import getpass
import os
import sys

from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.permissions import Role
from app.core.security import MIN_PASSWORD_LENGTH
from app.db.models import Base
from app.db.session import SessionLocal
from app.demo import seed_business_data
from app.demo_scenario import seed_scenario
from app.modules.partners.models import Partner
from app.modules.users import service as user_service
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate


def _ask_password() -> str:
    password = getpass.getpass(f"Şifre (en az {MIN_PASSWORD_LENGTH} karakter): ")
    if password != getpass.getpass("Şifre (tekrar): "):
        sys.exit("Şifreler eşleşmiyor.")
    return password


def create_admin(name: str, email: str, password: str | None) -> None:
    # Canlı ortamda şifre komut satırına yazılmaz; gizli değişkenden okunur.
    password = password or os.environ.get("VIA_ADMIN_PASSWORD")
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.email == email.strip().lower())):
            print(f"{email} zaten kayıtlı; değişiklik yapılmadı.")
            return
        user = user_service.create_user(
            db,
            UserCreate(
                full_name=name,
                email=email,
                role=Role.SUPER_ADMIN,
                password=password or _ask_password(),
            ),
            actor=None,
            context=None,
        )
        print(f"Yönetici oluşturuldu: {user.email}")


DEMO_ADMIN = ("Mustafa Karadeniz", "mustafa@viaevents.com", Role.SUPER_ADMIN)
DEMO_PARTNERS = [
    ("Alper", "alper@viaevents.com", Role.PARTNER),
    ("Volkan", "volkan@viaevents.com", Role.PARTNER),
    ("İbrahim", "ibrahim@viaevents.com", Role.PARTNER),
]
DEMO_STAFF = [
    ("Muhasebe Demo", "muhasebe@viaevents.com", Role.ACCOUNTING),
    ("Operasyon Demo", "operasyon@viaevents.com", Role.OPERATION),
    ("İzleyici Demo", "izleyici@viaevents.com", Role.VIEWER),
]


def _reset(db) -> None:  # noqa: ANN001
    tables = ", ".join(table.name for table in Base.metadata.sorted_tables)
    db.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    db.commit()


def seed_demo(password: str, reset: bool) -> None:
    if get_settings().environment == "production":
        sys.exit("Demo verisi canlı ortamda oluşturulamaz.")
    with SessionLocal() as db:
        if reset:
            _reset(db)
        if db.scalar(select(User.id).limit(1)) is not None:
            sys.exit("Veritabanı boş değil. Sıfırlamak için --reset ekleyin.")

        name, email, role = DEMO_ADMIN
        admin = user_service.create_user(
            db,
            UserCreate(full_name=name, email=email, role=role, password=password),
            actor=None,
            context=None,
        )
        partners: dict[str, Partner] = {}
        for order, (name, email, role) in enumerate(DEMO_PARTNERS, start=1):
            user = user_service.create_user(
                db,
                UserCreate(full_name=name, email=email, role=role, password=password),
                actor=None,
                context=None,
            )
            partner = Partner(full_name=name, email=email, sort_order=order, user_id=user.id)
            db.add(partner)
            partners[name] = partner
        staff: dict[Role, User] = {}
        for name, email, role in DEMO_STAFF:
            staff[role] = user_service.create_user(
                db,
                UserCreate(full_name=name, email=email, role=role, password=password),
                actor=None,
                context=None,
            )
        db.commit()
        seed_business_data(db, admin, partners)
        users = {
            "admin": admin,
            "accounting": staff[Role.ACCOUNTING],
            "operation": staff[Role.OPERATION],
        }
        seed_scenario(db, users, partners)

    print("Demo verisi yüklendi. Tüm hesapların şifresi verdiğiniz şifredir:")
    for name, email, role in [DEMO_ADMIN, *DEMO_PARTNERS, *DEMO_STAFF]:
        print(f"  {email:<28} {role.value:<12} {name}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    admin = commands.add_parser("create-admin", help="Yönetici kullanıcı oluşturur")
    admin.add_argument("--name", required=True)
    admin.add_argument("--email", required=True)
    admin.add_argument(
        "--password",
        help="Verilmezse VIA_ADMIN_PASSWORD okunur, o da yoksa güvenli şekilde sorulur",
    )

    demo = commands.add_parser("seed-demo", help="Boş veritabanına demo kullanıcı/ortak yükler")
    demo.add_argument("--password", required=True)
    demo.add_argument("--reset", action="store_true", help="Önce tüm tabloları boşaltır")

    args = parser.parse_args()
    if args.command == "create-admin":
        create_admin(args.name, args.email, args.password)
    elif args.command == "seed-demo":
        seed_demo(args.password, args.reset)


if __name__ == "__main__":
    main()
