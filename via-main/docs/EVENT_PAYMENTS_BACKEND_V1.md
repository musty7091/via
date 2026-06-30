# Etkinlik Ödeme Planı ve Tahsilat Takibi Backend v1

## Amaç

Anlaşmadan oluşan etkinlik dosyasının ödeme planı ve tahsilatlarını takip etmek.

## Backend endpointleri

- `GET /api/v1/events/{event_id}/payments`
- `POST /api/v1/events/{event_id}/payments/plans`
- `PUT /api/v1/events/{event_id}/payments/plans/{payment_plan_id}`
- `POST /api/v1/events/{event_id}/payments/collections`
- `POST /api/v1/events/{event_id}/payments/collections/{collection_id}/cancel`

## V1 kararları

- Ödeme planı fiziksel olarak silinmez.
- Tahsilat fiziksel olarak silinmez, iptal edilir.
- Tahsilat kaydında işlem yapan kullanıcı `received_by_user_id` alanına yazılır.
- Tahsilatı yapan ortak `received_by_partner_id` alanına yazılır.
- Ödeme planı durumu otomatik hesaplanır:
  - `pending`
  - `partial`
  - `paid`
- Tahsilat iptal edilirse ödeme planındaki ödenen tutar yeniden hesaplanır.

## Sonraki adım

Frontend etkinlik detay ekranına ödeme planı ve tahsilat bölümü eklenecek.
