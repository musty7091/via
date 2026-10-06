# VIA EVENTS — Canlıya Alma ve Bakım

Bu rehber uygulamayı **ücretsiz kotalar içinde** Google Cloud Run'da yayınlar.
Veritabanı Neon'un ücretsiz PostgreSQL'idir (Cloud SQL'in ücretsiz kotası yoktur).

| Parça | Nerede | Maliyet |
|---|---|---|
| Uygulama (ön yüz + API, tek imaj) | Cloud Run, `europe-west1` | Ücretsiz kota (ayda 2 milyon istek). Kullanılmayınca sıfıra iner. |
| Veritabanı | Neon, Frankfurt | Ücretsiz plan (0,5 GB) |
| Gizli değerler | Secret Manager | İlk 6 sürüm ücretsiz |
| İmajlar | Artifact Registry | 0,5 GB ücretsiz; son 2 imaj tutulur |
| Gece yedeği | Cloud Run Job + Cloud Scheduler → Cloud Storage | Ücretsiz kota; 30 gün saklanır |

> Pratikte maliyet sıfırdır. Yalnızca Avrupa'ya giden veri trafiği için ayda birkaç
> sent çıkabilir. Deneme süresinde (90 gün) Google, hesap "ücretli"ye geçirilmedikçe
> karttan para çekmez. Bütçe uyarısını mutlaka kurun (adım 6).

Bilinen bedel: Uygulama bir süre kullanılmazsa ilk açılış 3–5 saniye sürer
(Cloud Run sıfırdan başlar, Neon uykudan uyanır). Sonraki istekler hızlıdır.

---

## 1. Hesaplar (bir kez, tarayıcıdan)

1. İşletme adına bir Gmail açın (ör. `viaevents.kktc@gmail.com`).
2. Bu hesapla <https://console.cloud.google.com> adresine girin.
   - "Ücretsiz denemeyi başlat" ile faturalandırmayı açın (işletmenin/sahibinin kartı).
   - Yeni proje oluşturun: ad `VIA EVENTS`. Proje kimliğini not edin (ör. `via-events-482913`).
3. Aynı Gmail ile <https://neon.tech> adresine girin (Google ile giriş).
   - Proje oluşturun: Postgres 17, bölge **AWS Europe Central 1 (Frankfurt)**.
   - "Connection string" kutusunda **Connection pooling kapalı** (direct) adresi kopyalayın.
   - Adresin başındaki `postgresql://` kısmını `postgresql+psycopg://` yapın.
     Örnek: `postgresql+psycopg://neondb_owner:...@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`

## 2. Bilgisayarda giriş

Git Bash'te, depo kök klasöründe:

```bash
gcloud auth login                          # yeni Gmail ile
export VIA_GCP_PROJECT=via-events-482913   # kendi proje kimliğiniz
```

Docker Desktop açık olmalı.

## 3. Kurulum (bir kez)

```bash
bash infra/gcp/setup.sh "postgresql+psycopg://...neon.tech/neondb?sslmode=require"
```

Bu komut şunları yapar:
- API'leri açar.
- İmaj deposunu ve temizleme kuralını kurar.
- En az yetkili servis hesaplarını oluşturur.
- Veritabanı adresini ve rastgele oturum anahtarını Secret Manager'a koyar.
- Yedek kovasını oluşturur.

## 4. Yayın (her güncellemede)

```bash
bash infra/gcp/deploy.sh
```

Bu komut şunları yapar:
- İmajı bilgisayarda derler (Cloud Build kullanılmaz) ve yükler.
- Veritabanı geçişlerini (`alembic upgrade head`) ayrı bir işte çalıştırır.
- Servisi günceller.

Yayından önce `apps/` altında commit edilmemiş değişiklik bırakmayın; betik bunu kontrol eder.

## 5. İlk yönetici ve gece yedeği (bir kez)

```bash
bash infra/gcp/create-admin.sh "Mustafa Karadeniz" mustafa@...    # şifreyi sorar, loglara yazmaz
bash infra/gcp/backup-setup.sh                                    # her gece 03:00 yedek + deneme yedeği
```

Canlı ortamda demo verisi yüklenemez. Ortakları ve kullanıcıları uygulama içinden ekleyin.

## 6. Bütçe uyarısı (bir kez, konsoldan)

Faturalandırma → Bütçeler ve uyarılar → Bütçe oluştur:
- Tutar: 1 USD.
- Uyarılar: %50, %90, %100.
- Bildirim: e-posta.

## Yedekten geri dönme

Yedekler `gs://<proje-kimliği>-via-backups/` kovasındadır (30 gün).

```bash
gcloud storage cp gs://<proje>-via-backups/via-YYYYMMDD-HHMMSS.sql.gz .
# Neon'da yeni ve boş bir veritabanı (veya dal / branch) oluşturun, sonra:
gunzip -c via-YYYYMMDD-HHMMSS.sql.gz | psql "postgresql://...neon.tech/yeni_db?sslmode=require"
# Uygulamayı yeni veritabanına çevirmek için:
printf '%s' "postgresql+psycopg://.../yeni_db?sslmode=require" | \
  gcloud secrets versions add via-database-url --data-file=-
bash infra/gcp/deploy.sh
```

Neon ayrıca son saatler için zamana dönük geri yükleme (branch) sunar.
Küçük kazalar için önce onu deneyin.

## Güvenlik özeti

- **Oturum çerezi:** `HttpOnly`, `Secure`, `SameSite=Lax`.
- **Veri değiştiren istekler:** `X-Requested-With` başlığı zorunludur (CSRF).
- **Kaba kuvvete karşı:**
  - Bir hesaba 5 hatalı denemede hesap 15 dakika kilitlenir.
  - Tek IP'den 15 dakikada 20 hatalı deneme sınırı vardır.
- **İstemci IP'si** yalnızca Cloud Run'ın eklediği değerden okunur, istemcinin yazdığı değer dikkate alınmaz (`VIA_TRUSTED_PROXIES=1`).
- **Güvenlik başlıkları:** CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`. API yanıtları önbelleğe alınmaz.
- **API dokümantasyonu** (`/docs`) canlıda kapalıdır.
- **Uygulama** root olmayan kullanıcıyla çalışır.
- **Gizli değerler** imajda veya depoda değil, Secret Manager'dadır.

## Sahibine teslim

Hesap baştan işletme adına açıldığı için taşıma gerekmez:
- Gmail şifresini ve kurtarma bilgilerini sahibine verin.
- Kendi hesabınızı projeye "Sahip" olarak ekleyip bakımı sürdürebilirsiniz.
- Deneme süresi bitmeden sahibi "Ücretli hesaba geç" demelidir. Aksi halde servisler durur. Bu adım tek başına ücret doğurmaz; ücretsiz kotalar devam eder.
