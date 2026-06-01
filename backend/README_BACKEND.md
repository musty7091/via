# VIA EVENTS Backend

Backend FastAPI ile geliştirilecektir.

Bu aşamada migration kullanılmaz. Proje henüz erken aşamada olduğu için local SQLite veritabanı tek seferde geniş tablo setiyle oluşturulur.

## Local Çalıştırma

Backend klasörüne gir:

```powershell
cd C:\via\backend
```

Sanal ortamı aktif et:

```powershell
.\.venv\Scripts\Activate.ps1
```

Veritabanını baştan oluştur:

```powershell
python -m app.db.init_db
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

## Oluşturulan Ana Tablolar

- users
- partners
- partner_account_movements
- customers
- customer_contacts
- venues
- artists
- artist_rider_template_items
- service_items
- events
- event_items
- event_profit_snapshots
- offers
- offer_items
- payment_plans
- collections
- cash_accounts
- cash_transfers
- expenses
- expense_allocations
- operation_tasks
- event_rider_checks
- operation_notes
- monthly_periods
- monthly_partner_summaries
- currency_rates
- documents
- audit_logs
- system_settings