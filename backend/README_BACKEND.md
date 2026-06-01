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

## Varsayılan Local Admin

Local geliştirme için oluşturulan ilk admin:

```text
E-posta: admin@via.local
Şifre: Via12345!
```

Bu bilgi sadece local geliştirme içindir. Canlı ortamda mutlaka değiştirilecektir.

## Auth Endpointleri

```text
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

Login JSON örneği:

```json
{
  "email": "admin@via.local",
  "password": "Via12345!"
}
```

## Veritabanı

Local geliştirme SQLite ile yapılacaktır.

Canlı ortam hedefi PostgreSQL ve Google Cloud Run'dır.

Veritabanı bağlantısı `.env` dosyasındaki `DATABASE_URL` değeriyle yönetilir.

## Migration

Migration çalıştırmak için:

```powershell
cd C:\via\backend
.\.venv\Scripts\Activate.ps1
alembic upgrade head
```
