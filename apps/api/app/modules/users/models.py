from datetime import datetime

from sqlalchemy import DateTime, Integer, String, false
from sqlalchemy.orm import Mapped, mapped_column

from app.core.permissions import Role
from app.db.base import Base, TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(default=True)
    # Yönetici şifre belirlediğinde (yeni hesap/sıfırlama) kullanıcı ilk girişte değiştirir.
    must_change_password: Mapped[bool] = mapped_column(default=False, server_default=false())

    # Şifre değişince/hesap kapanınca artar; eski oturumlar geçersiz olur.
    token_version: Mapped[int] = mapped_column(Integer, default=1)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
