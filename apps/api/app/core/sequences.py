"""Belge numaraları (teklif, etkinlik...).

Numara, satır kilidiyle (SELECT ... FOR UPDATE) artırılır: aynı anda iki teklif
açılsa bile aynı numara asla iki kez verilmez. Numara yıl bazında sıfırlanır.
"""

from sqlalchemy import Integer, String, UniqueConstraint, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.db.base import Base


class DocumentSequence(Base):
    __tablename__ = "document_sequences"
    __table_args__ = (UniqueConstraint("name", "year"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(20))
    year: Mapped[int] = mapped_column(Integer)
    last_value: Mapped[int] = mapped_column(Integer, default=0)


def next_number(db: Session, name: str, year: int, prefix: str) -> str:
    """Örn. next_number(db, "offer", 2026, "VIA-T") -> "VIA-T-2026-0001"."""
    seq = db.scalar(
        select(DocumentSequence)
        .where(DocumentSequence.name == name, DocumentSequence.year == year)
        .with_for_update()
    )
    if seq is None:
        seq = DocumentSequence(name=name, year=year, last_value=0)
        db.add(seq)
    seq.last_value += 1
    db.flush()
    return f"{prefix}-{year}-{seq.last_value:04d}"
