# VIA EVENTS Backend

Backend FastAPI ile geliştirilecektir.

## Local Çalıştırma

Backend klasörüne gir:

```powershell
cd C:\via\backend
```

Sanal ortamı aktif et:

```powershell
.\.venv\Scripts\Activate.ps1
```

API'yi çalıştır:

```powershell
uvicorn app.main:app --reload
```

Tarayıcıda kontrol:

```text
http://127.0.0.1:8000
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/api/v1/health
```

## Veritabanı

Local geliştirme SQLite ile yapılacaktır.

Canlı ortam hedefi PostgreSQL ve Google Cloud Run'dır.

Veritabanı bağlantısı `.env` dosyasındaki `DATABASE_URL` değeriyle yönetilir.
