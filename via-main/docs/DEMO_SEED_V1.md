# Demo Seed Paketi v1

## Amaç

Boş veya eksik local veritabanını satış/demo/test için anlamlı verilerle doldurur.

## Komut

```powershell
cd C:\via\backend
.\.venv\Scripts\Activate.ps1
python -m app.db.seed_demo
```

## İçerik

- Demo kullanıcılar
- Demo ortaklar
- Demo müşteriler
- Demo yetkililer
- Demo mekanlar
- Demo sanatçılar
- Demo rider template kalemleri
- Demo teknik/operasyon hizmetleri
- Demo kombo paketler
- Demo teklifler
- Demo anlaşmaya dönmüş etkinlik dosyaları
- Demo ödeme planları
- Demo tahsilatlar
- Demo giderler
- Demo operasyon görevleri
- Demo rider kontrolleri
- Demo karlılık snapshot kayıtları

## Demo kullanıcıları

- `demo.accounting@viaevents.com` / `Demo12345!`
- `demo.operation@viaevents.com` / `Demo12345!`
- `demo.partner@viaevents.com` / `Demo12345!`
- `demo.viewer@viaevents.com` / `Demo12345!`

## Güvenlik

Demo kayıtları `[DEMO]` ve `DEMO-` işaretleri ile oluşturulur. Script tekrar çalıştırıldığında önce eski demo kayıtlarını temizler, sonra yeniden oluşturur.
