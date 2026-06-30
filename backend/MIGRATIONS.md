# Veritabanı Migration Rehberi (Alembic)

VIA EVENTS artık şema değişikliklerini **Alembic** ile yönetir.

## Nasıl çalışır
- Uygulama açılışında `bootstrap` çalışır:
  1. `create_all` taban şemayı kurar (yeni/boş veritabanı için).
  2. `apply_migrations()` Alembic'i **benimser**: sürüm yoksa mevcut şemayı başa
     sabitler (`stamp head`), sürüm varsa **bekleyen migration'ları uygular** (`upgrade head`).
  3. Seed ve performans index'leri çalışır.
- Yani deploy sırasında ek bir komuta gerek yoktur; `python -m app.db.bootstrap`
  hem şemayı hem migration'ları halleder.

## Model değiştirdiğinde (yeni sütun, tablo, vb.)
> Önemli: `create_all` yalnızca EKSİK TABLOLARI oluşturur; mevcut bir tabloya
> sütun EKLEYEMEZ. Bu yüzden mevcut tablolardaki her değişiklik için migration üret.

```bash
cd backend
# 1) Modeli değiştir (ör. app/models/...)
# 2) Migration üret (otomatik fark bul)
alembic revision --autogenerate -m "kisa aciklama"
# 3) Üretilen dosyayı alembic/versions/ altında GÖZDEN GEÇİR
# 4) Yerelde uygula ve test et
alembic upgrade head
pytest
# 5) Commit + push -> deploy'da bootstrap otomatik 'upgrade head' uygular
```

## Faydalı komutlar
```bash
alembic current            # DB hangi sürümde
alembic history            # migration geçmişi
alembic upgrade head       # en güncele yükselt
alembic downgrade -1       # bir adım geri al
alembic stamp head         # şemayı (çalıştırmadan) başa sabitle
```

## Notlar
- Veritabanı adresi `DATABASE_URL`'den okunur (alembic.ini'de sabit URL yok).
- SQLite üzerinde ALTER için `render_as_batch=True` (batch mode) açıktır.
- Mevcut bir veritabanını Alembic'e ilk kez geçirirken otomatik `stamp head`
  uygulanır; manuel işlem gerekmez.
