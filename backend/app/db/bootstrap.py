"""
VIA EVENTS — Dağıtım (deploy) açılış hazırlığı.

init_db.py'den FARKI: tabloları SİLMEZ. Yoksa oluşturur, varsa dokunmaz.
Temel verileri (admin, ortaklar, kasa/banka, sistem ayarları) yalnızca
eksikse ekler. Bu yüzden her uygulama açılışında güvenle çalıştırılabilir;
mevcut veriler korunur.

Canlı ortamda (Render vb.) uygulama başlarken otomatik çağrılır.
"""

from pathlib import Path

from sqlalchemy import text

from app.db.database import SessionLocal, engine
from app.db.init_db import (
    Base,
    seed_admin_user,
    seed_default_cash_accounts,
    seed_default_partners,
    seed_system_settings,
)


def apply_migrations() -> None:
    """Alembic migration'larını güvenli şekilde uygular (auto-adopt).

    - Veritabanında henüz Alembic sürümü yoksa: şema zaten create_all ile
      kurulduğu için Alembic'i mevcut başa (head) SABİTLER (stamp). Böylece
      create_all ile kurulu mevcut/yeni veritabanları bozulmadan benimsenir.
    - Sürüm varsa: bekleyen migration'ları UYGULAR (upgrade head). Yani
      sonradan eklenen sütun/tablo değişiklikleri otomatik işlenir.
    """
    try:
        from alembic import command
        from alembic.config import Config
        from alembic.runtime.migration import MigrationContext
    except Exception:
        # Alembic kurulu değilse sessizce geç (yerel hızlı başlatma)
        return

    try:
        backend_root = Path(__file__).resolve().parents[2]
        ini_path = backend_root / "alembic.ini"
        if not ini_path.exists():
            return

        cfg = Config(str(ini_path))
        cfg.set_main_option("script_location", str(backend_root / "alembic"))

        with engine.connect() as conn:
            current = MigrationContext.configure(conn).get_current_revision()

        if current is None:
            # Şema create_all ile kurulu; Alembic'i başa sabitle (migration çalıştırma)
            command.stamp(cfg, "head")
            print("[bootstrap] Alembic mevcut şemaya sabitlendi (stamp head).")
        else:
            # Bekleyen migration'ları uygula
            command.upgrade(cfg, "head")
            print("[bootstrap] Alembic migration'ları uygulandı (upgrade head).")
    except Exception as exc:
        # ÖNEMLİ: Migration adımı başlatmayı ASLA engellemez. Şema zaten
        # create_all ile kuruludur; hata yalnızca loglanır.
        print(f"[bootstrap] Alembic adımı atlandı (hata): {exc}")


# Performans index'leri.
# Şema zaten tüm FK ve çoğu tarih sütununda tekil index taşır; aşağıdakiler
# eksik kalan tekil sütunlar ile sık kullanılan ÇOK SÜTUNLU (composite) sorgu
# yollarını hızlandırır. "CREATE INDEX IF NOT EXISTS" sayesinde her açılışta
# güvenle çalışır (varsa atlar) ve hem SQLite hem PostgreSQL'de geçerlidir.
PERFORMANCE_INDEXES = [
    # --- Eksik tekil index'ler ---
    ("ix_events_status", "events", "(status)"),
    ("ix_offers_status", "offers", "(status)"),
    ("ix_offers_event_date", "offers", "(event_date)"),
    ("ix_expenses_status", "expenses", "(status)"),
    ("ix_partner_movements_type", "partner_account_movements", "(movement_type)"),
    # --- Bileşik (composite) index'ler: sık sorgu yolları ---
    # Dönem/özet: hareketleri döneme + türe göre süzme
    ("ix_perf_finmov_period_type", "financial_movements", "(period_month, movement_type)"),
    # Etkinlik bazlı hareket geçmişi
    ("ix_perf_finmov_event_date", "financial_movements", "(event_id, movement_date)"),
    # Müşteri ekstresi: müşteriye göre tarih sıralı
    ("ix_perf_custmov_customer_date", "customer_account_movements", "(customer_id, movement_date)"),
    # Ortak bakiyesi: ortağa + döneme göre
    ("ix_perf_partnermov_partner_period", "partner_account_movements", "(partner_id, monthly_period_id)"),
    # Etkinliğin açık tedarikçi/sanatçı borçları (dönem maliyeti)
    ("ix_perf_payable_event_status", "event_supplier_payables", "(event_id, status)"),
    # Devir kalemleri: hedef döneme + duruma göre
    ("ix_perf_carry_target_status", "carry_forward_items", "(target_period_month, status)"),
    # Etkinlik finansal kapanışı: etkinliğe + duruma göre
    ("ix_perf_closure_event_status", "event_financial_closures", "(event_id, status)"),
    # Dönem raporu: tarih + durum
    ("ix_perf_events_date_status", "events", "(event_date, status)"),
    # Tahsilatlar: müşteriye + tarihe göre
    ("ix_perf_collection_customer_date", "collections", "(customer_id, collection_date)"),
]


def ensure_performance_indexes() -> None:
    """Performans index'lerini idempotent şekilde oluşturur (varsa atlar)."""
    with engine.begin() as conn:
        for name, table, cols in PERFORMANCE_INDEXES:
            try:
                conn.execute(
                    text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} {cols}")
                )
            except Exception as exc:  # tek bir index hatası açılışı engellemesin
                print(f"[bootstrap] index atlandı: {name} ({exc})")


def bootstrap() -> None:
    # 1) Alembic migration'larını ÖNCE uygula/benimse.
    #    Böylece yeni tabloları (henüz yokken) migration oluşturur; ardından
    #    create_all yalnızca eksik kalanı tamamlar (var olanı atlar). Bu sıra,
    #    "tablo zaten var" çakışmasını önler.
    apply_migrations()

    # 2) Tabloları SİLMEDEN oluştur (varsa atlar) — taban şema / güvenlik ağı
    Base.metadata.create_all(bind=engine)

    # 3) Performans index'lerini garanti et (mevcut DB'ye de uygulanır)
    ensure_performance_indexes()

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
