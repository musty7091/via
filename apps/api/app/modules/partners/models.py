from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.modules.users.models import User


class Partner(TimestampMixin, Base):
    """Şirket ortağı. Kâr ve zarar aktif ortaklar arasında eşit bölünür.

    `sort_order`: eşit bölmede artan kuruşların hangi sırayla dağıtılacağını belirler.
    """

    __tablename__ = "partners"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(254))
    is_active: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)
    notes: Mapped[str | None] = mapped_column(Text)

    # Ortağın giriş yaptığı kullanıcı hesabı (opsiyonel, bire bir)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), unique=True)
    user: Mapped[User | None] = relationship(lazy="joined")
