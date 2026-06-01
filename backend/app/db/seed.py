from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.user import UserRole
from app.services.user_service import create_user, get_user_by_email


def seed_admin_user(db: Session) -> None:
    existing_user = get_user_by_email(db=db, email=settings.admin_email)

    if existing_user is not None:
        print(f"Admin kullanıcısı zaten var: {settings.admin_email}")
        return

    create_user(
        db=db,
        full_name=settings.admin_full_name,
        email=settings.admin_email,
        password=settings.admin_password,
        role=UserRole.SUPER_ADMIN.value,
        is_active=True,
    )

    print(f"Admin kullanıcısı oluşturuldu: {settings.admin_email}")


def main() -> None:
    db = SessionLocal()

    try:
        seed_admin_user(db=db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
