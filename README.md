# VIA EVENTS

3 ortaklı etkinlik şirketi (KKTC) için operasyon ve ön muhasebe sistemi:
katalog → teklif → anlaşma/etkinlik → tahsilat ve borçlar → operasyon → etkinlik ve dönem kapanışı
→ ortak kâr payları → raporlar.

| Klasör | İçerik |
|---|---|
| `apps/api` | FastAPI + SQLAlchemy + PostgreSQL (çift taraflı defter, Alembic geçişleri, testler) |
| `apps/web` | React + TypeScript + Tailwind (ortak bileşen kütüphanesi `src/shared/ui`) |
| `infra/gcp` | Google Cloud Run + Neon yayın, yedek ve yönetici betikleri |
| `docs` | [Yayın ve bakım rehberi](docs/YAYIN.md), [proje röntgeni ve kararlar](docs/PROJE_RONTGENI_2026_10.md), [eski sürümün iş kuralları](docs/arsiv-v1/) |

Canlıya alma ve yedekten dönme: [docs/YAYIN.md](docs/YAYIN.md).

## Geliştirme ortamı

### İlk kurulum (bir kez)

```powershell
cd C:\via
docker compose up -d                      # PostgreSQL

cd C:\via\apps\api
copy .env.example .env
python -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
.venv\Scripts\alembic upgrade head        # tabloları oluşturur
.venv\Scripts\python -m app.cli seed-demo --password "Via-Demo-2026"   # --reset: önce her şeyi siler

cd C:\via\apps\web
npm install
```

Gerçek kullanımda demo yerine sadece yönetici oluşturulur (şifre güvenli şekilde sorulur):

```powershell
.venv\Scripts\python -m app.cli create-admin --name "Ad Soyad" --email ornek@viaevents.com
```

### Her gün

İki ayrı terminalde:

```powershell
cd C:\via\apps\api;  .venv\Scripts\uvicorn app.main:app --port 8000
cd C:\via\apps\web;  npm run dev
```

Backend kodu değişirse API penceresini kapatıp (Ctrl+C) aynı komutla yeniden başlatın.
(Windows'ta `--reload` seçeneği güvenilir çalışmadığı için kullanılmıyor.)

Uygulama: http://127.0.0.1:5173 · API dokümanı: http://127.0.0.1:8000/docs

### Kontroller

```powershell
cd C:\via\apps\api;  .venv\Scripts\python -m pytest;  .venv\Scripts\ruff check .
cd C:\via\apps\web;  npm run typecheck;  npm run lint
```

### Backend değişince

```powershell
cd C:\via\apps\api;  .venv\Scripts\alembic revision --autogenerate -m "aciklama";  .venv\Scripts\alembic upgrade head
cd C:\via\apps\web;  npm run api:types     # frontend tiplerini API'den yeniden üretir
```

## Kurallar

- Ekranlar sadece `apps/web/src/shared/ui` bileşenlerini kullanır; sayfada renk kodu veya özel stil yazılmaz.
- Para hesapları sadece backend'de, `app/core/money.py` ile yapılır.
- Her endpoint bir yetki ister (`app/core/permissions.py`); kritik işlemler işlem geçmişine yazılır.
