# VIA EVENTS Moduler Yapi Kurallari

Bu proje buyuyecek sekilde tasarlanmistir. Bu nedenle dosyalar en bastan kucuk, okunabilir ve sorumlulugu net olacak sekilde ayrilir.

## Genel Kural

Bir dosya buyumeye aday ise tek dosyada tutulmaz.

Ozellikle su katmanlar moduler tutulur:

- Veritabani modelleri
- API route dosyalari
- Schema dosyalari
- Service dosyalari
- Repository / sorgu dosyalari
- Frontend feature klasorleri
- Frontend component dosyalari

## Backend Model Kurali

Ayni is alanina bagli olsa bile buyuyecek modeller ayri dosyalarda tutulur.

Ornek musteri alani:

```text
backend/app/models/customer.py
backend/app/models/customer_contact.py
backend/app/models/venue.py
backend/app/models/customer_account_movement.py
```

## Backend Modul Kurali

Buyuk is alanlari kendi modul klasorunde yonetilir.

Ornek:

```text
backend/app/modules/customers/
├── router.py
├── schemas.py
├── service.py
├── repository.py
├── ledger_service.py
├── constants.py
└── __init__.py
```

## Frontend Kurali

Buyuk ekranlar tek dosyada buyutulmez. Feature bazli ayrilir.

Ornek:

```text
frontend/src/features/customers/
├── api/
├── components/
├── constants/
├── pages/
└── types/
```

## Musteri Hesap Hareketleri Kurali

Musteri hesap hareketleri cari hesap mantigiyla tutulur.

- Borc hareketi musterinin bakiyesini artirir.
- Alacak / tahsilat hareketi musterinin bakiyesini azaltir.
- Kumulatif bakiye rapor aninda tarih sirasina gore hesaplanir.
- Tahsilat satirlarinda tahsilati yapan ortak bilgisi gosterilir.
- Hareket silinmez; iptal veya ters kayit mantigi kullanilir.