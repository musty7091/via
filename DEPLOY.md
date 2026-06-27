# VIA EVENTS — Render'da Ücretsiz Canlı Test Kılavuzu

Bu kılavuz, uygulamayı **Render**'da ücretsiz olarak canlıya almanı sağlar.
Frontend ve backend **tek bir serviste** çalışır (Docker), veritabanı ücretsiz
**PostgreSQL**'dir.

> Önemli: Render'ın ücretsiz web servisi, bir süre trafik olmazsa uykuya geçer;
> uykudan sonraki ilk istek ~1 dakika sürebilir. Test/demo için sorun değildir.
> Ücretsiz PostgreSQL'in de süre sınırı olabilir (genelde ~30 gün); süresi dolarsa
> yeni bir veritabanı oluşturup `DATABASE_URL`'i güncellemen gerekir.

---

## 0) Hazırlık: Kodu GitHub'a koy

Render kodu GitHub'dan çeker. Proje klasörünü bir GitHub deposuna yükle
(zaten yapıyorsan bu adımı atla). Deponun kökünde şu dosyalar olmalı:
`Dockerfile`, `render.yaml`, `backend/`, `frontend/`.

---

## 1) En kolay yol: Blueprint (render.yaml ile tek tık)

1. https://render.com adresinde ücretsiz hesap aç (kredi kartı gerekmez).
2. **New +  → Blueprint** de.
3. GitHub deponu seç. Render kökteki `render.yaml`'i bulur ve şunları önerir:
   - `via-events` (web servisi)
   - `via-events-db` (ücretsiz PostgreSQL)
4. **Apply** de.
5. Render iki ortam değişkenini senden ister (sync: false olanlar):
   - `ADMIN_EMAIL`  → giriş için e-posta (ör. `admin@viaevents.com`)
   - `ADMIN_PASSWORD` → **güçlü bir şifre belirle** (varsayılanı kullanma!)
6. **Create / Deploy** de ve bekle. İlk derleme birkaç dakika sürer
   (frontend derlenir, backend kurulur).

Bittiğinde sana `https://via-events-XXXX.onrender.com` gibi bir adres verir.
O adrese girip belirlediğin e-posta/şifre ile giriş yapabilirsin.

---

## 2) Alternatif: Elle kurulum (Blueprint çalışmazsa)

### a) Veritabanı
1. **New + → PostgreSQL** → isim: `via-events-db`, plan: **Free** → **Create**.
2. Oluşunca **Internal Database URL**'i kopyala (sonraki adımda lazım).

### b) Web servisi
1. **New + → Web Service** → GitHub deponu seç.
2. Render kökteki `Dockerfile`'ı otomatik algılar (Runtime: **Docker**).
3. Plan: **Free**.
4. **Environment** sekmesinde şu değişkenleri ekle:
   - `DATABASE_URL` → (a)'da kopyaladığın PostgreSQL URL'i
   - `SECRET_KEY` → uzun rastgele bir metin (ör. parola üreticiyle)
   - `ADMIN_EMAIL` → giriş e-postan
   - `ADMIN_PASSWORD` → güçlü şifren
   - `APP_ENV` → `production`
5. **Create Web Service** de. Derleme bitince adresin hazır.

---

## 3) Giriş

- Adres: Render'ın verdiği `https://....onrender.com`
- E-posta / şifre: `ADMIN_EMAIL` / `ADMIN_PASSWORD` olarak girdiğin değerler

Uygulama ilk açılışta veritabanı tablolarını otomatik oluşturur ve temel verileri
(admin, 3 ortak, kasa/banka, ayarlar) ekler. **Mevcut veriyi silmez.**

---

## 4) Canlıda veriyi sıfırlamak (temiz test için)

Render web servisinde **Shell** sekmesini aç ve şunu çalıştır:

```bash
python -m app.db.reset_db
```

Onay olarak `SIFIRLA` yaz. Bu, tüm işlem verisini siler ve yalnızca temel
verileri yeniden kurar. (Geri alınamaz — dikkatli ol.)

---

## 5) Yerelde çalışmaya devam

Bu değişiklikler yerel geliştirmeyi bozmaz:
- Backend: `uvicorn app.main:app --reload`  (varsayılan SQLite ile)
- Frontend: `npm run dev`  → `/api` istekleri otomatik olarak 8000'e yönlenir
  (Vite proxy sayesinde).

---

## Notlar
- Frontend ve backend aynı adresten servis edildiği için **CORS ayarı gerekmez**.
- `SECRET_KEY`'i mutlaka güçlü ve gizli tut; oturum güvenliği buna bağlıdır.
- Ücretsiz katmanın uyku/limit davranışı test için uygundur; gerçek kullanım için
  Render'ın ücretli planına geçebilirsin (uyku kalkar).
