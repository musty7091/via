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

## Build Testi

```powershell
npm run build
```

## API Bağlantısı

Local backend adresi `.env` dosyasında tutulur:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```
