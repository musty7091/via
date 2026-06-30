# VIA EVENTS Frontend

Frontend React, TypeScript, Vite ve Tailwind CSS ile geliştirilecektir.

Tasarım mobil önceliklidir.

## Local Çalıştırma

Frontend klasörüne gir:

```powershell
cd C:\via\frontend
```

Geliştirme sunucusunu başlat:

```powershell
npm run dev
```

Tarayıcıda aç:

```text
http://127.0.0.1:5173
```

## Backend Bağlantısı

Frontend login ekranı local backend'e bağlanır.

Backend local adresi:

```text
http://127.0.0.1:8000/api/v1
```

Bu adres `.env` dosyasında tutulur:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## Local Login Bilgisi

```text
E-posta: admin@viaevents.com
Şifre: Via12345!
```

## Build Testi

```powershell
npm run build
```