"""
VIA EVENTS — Veritabanı Sıfırlama (tüm veriyi temizler).

DİKKAT: Bu işlem GERİ ALINAMAZ.
Tüm etkinlik, müşteri, teklif, gider, tahsilat, finans hareketi, dönem kapanışı
ve devir kayıtları KALICI olarak silinir. Ardından veritabanı sıfırdan kurulur
ve yalnızca temel veriler yeniden oluşturulur:
  - Admin kullanıcısı
  - 3 varsayılan ortak
  - Ana Kasa + Ana Banka hesabı
  - Sistem ayarları (KDV, ana para birimi vb.)

Kullanım:
  python -m app.db.reset_db            # onay sorar ("SIFIRLA" yazmalısın)
  python -m app.db.reset_db --force    # onay sormadan sıfırlar (dikkatli ol)

Canlı (production) veritabanında çalıştırmadan önce DATABASE_URL'in doğru
ortama işaret ettiğinden emin ol.
"""

import sys

from app.core.config import settings
from app.db.init_db import main as init_main


def _mask_db_url(url: str) -> str:
    """Bağlantı adresindeki şifreyi gizleyerek gösterir."""
    if "@" in url and "//" in url:
        try:
            scheme, rest = url.split("//", 1)
            creds, host = rest.split("@", 1)
            if ":" in creds:
                user = creds.split(":", 1)[0]
                creds = f"{user}:****"
            return f"{scheme}//{creds}@{host}"
        except ValueError:
            return url
    return url


def run() -> None:
    is_force = "--force" in sys.argv or "--yes" in sys.argv

    print("=" * 64)
    print("VIA EVENTS — VERİTABANI SIFIRLAMA")
    print("-" * 64)
    print(f"Ortam (APP_ENV)   : {settings.app_env}")
    print(f"Hedef veritabanı  : {_mask_db_url(settings.database_url)}")
    print("-" * 64)
    print("Bu işlem TÜM verileri KALICI olarak siler ve geri alınamaz!")
    print("Sadece temel veriler (admin, ortaklar, kasa, ayarlar) yeniden kurulur.")
    print("=" * 64)

    if not is_force:
        answer = input('Devam etmek için büyük harfle SIFIRLA yazın: ').strip()
        if answer != "SIFIRLA":
            print("İptal edildi. Hiçbir veri değiştirilmedi.")
            return

    # init_db.main() zaten tüm tabloları düşürüp yeniden kurar ve temel verileri ekler.
    init_main()

    print("")
    print("Sıfırlama tamamlandı. Veritabanı temiz; sadece temel veriler mevcut.")
    print(f"Giriş: {settings.admin_email}")


if __name__ == "__main__":
    run()
