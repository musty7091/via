"""
VIA EVENTS — Dağıtım (deploy) açılış hazırlığı.

init_db.py'den FARKI: tabloları SİLMEZ. Yoksa oluşturur, varsa dokunmaz.
Temel verileri (admin, ortaklar, kasa/banka, sistem ayarları) yalnızca
eksikse ekler. Bu yüzden her uygulama açılışında güvenle çalıştırılabilir;
mevcut veriler korunur.

Canlı ortamda (Render vb.) uygulama başlarken otomatik çağrılır.
"""

from app.db.database import SessionLocal, engine
from app.db.init_db import (
    Base,
    seed_admin_user,
    seed_default_cash_accounts,
    seed_default_partners,
    seed_system_settings,
)


def bootstrap() -> None:
    # Tabloları SİLMEDEN oluştur (varsa atlar)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_admin_user(db=db)
        seed_default_partners(db=db)
        seed_default_cash_accounts(db=db)
        seed_system_settings(db=db)
    finally:
        db.close()


if __name__ == "__main__":
    bootstrap()
    print("Bootstrap tamamlandı (veriler korundu).")
