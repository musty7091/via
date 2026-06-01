# VIA EVENTS

VIA EVENTS; etkinlik ve organizasyon şirketleri için geliştirilen, etkinlik planlama, sanatçı/hizmet yönetimi, ön muhasebe, operasyon takibi, kasa/tahsilat kontrolü, dönem kapanışı ve ortak kâr paylaşımı süreçlerini yöneten modern bir web uygulamasıdır.

Uygulama hem bilgisayarda hem mobilde kullanılacak şekilde tasarlanacaktır. Mobil kullanım önceliklidir.

---

## Projenin Ana Amacı

VIA EVENTS'in amacı, bir etkinlik/organizasyon şirketinin şu süreçlerini tek merkezden yönetmektir:

- Etkinlik ve organizasyon planlama
- Müşteri ve teklif yönetimi
- Sanatçı, grup, dansçı ve hizmet yönetimi
- Ön ödeme ve kalan ödeme takibi
- 3 farklı para birimiyle işlem takibi
- Faturalı / faturasız anlaşma ayrımı
- %16 KDV hesaplama mantığı
- Operasyon personeli ve görev listeleri
- Sanatçı rider / kulis şartları kontrolü
- Etkinlik bazlı gelir-gider-kârlılık hesabı
- Sanatçı bazlı kârlılık raporu
- Genel aylık kârlılık raporu
- Ortak bazlı tahsilat ve mahsuplaşma takibi
- Aylık dönem kapanışı
- Kasa, banka ve muhasebe onay süreçleri
- PDF/print belge üretimi
- Güvenli çok kullanıcılı sistem

Bu proje sadece bir web sitesi değildir. Bu proje, VIA EVENTS işletmesinin operasyon ve muhasebe beynidir.

---

## Temel İş Modeli

Şirket 3 ortaklıdır.

Her ortak ayrı ayrı managerlik hizmeti verebilir. Ancak her managerin yaptığı her işte 3 ortak da ortak kabul edilir.

Bu nedenle sistemde her etkinlik için şu ayrım net tutulmalıdır:

- İşi hangi ortak / manager getirdi?
- Müşteriyle anlaşma tutarı nedir?
- Hangi sanatçı / hizmet kullanıldı?
- Şirketin sanatçıya veya hizmete ödeyeceği maliyet nedir?
- Etkinliğe bağlı operasyon giderleri nelerdir?
- Tahsilatı kim aldı?
- Tahsilat ana kasaya geçti mi?
- Ana kasaya geçmediyse hangi ortağın üzerinde duruyor?
- Etkinlik gerçek net kârı nedir?
- Net kâr 3 ortağa eşit nasıl bölüşülür?

---

## Teknik Mimari

Backend ve frontend ayrılmış şekilde geliştirilecektir.

### Backend

- Python
- FastAPI
- SQLAlchemy 2.x
- Alembic
- Pydantic
- JWT tabanlı oturum sistemi
- Rol bazlı yetki sistemi
- Local geliştirmede SQLite
- Canlı ortamda PostgreSQL
- Google Cloud Run uyumlu yapı

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Mobil öncelikli responsive tasarım
- PWA uyumlu yapı
- Modern yönetim paneli deneyimi

### Veritabanı

Local geliştirme:

- SQLite

Canlı ortam hedefi:

- PostgreSQL
- Google Cloud Run
- Google Cloud SQL veya uygun PostgreSQL servisi

---

## Proje Klasör Yapısı

```text
C:\via
├── backend
│   ├── app
│   │   ├── api
│   │   ├── core
│   │   ├── db
│   │   ├── models
│   │   ├── schemas
│   │   ├── services
│   │   ├── utils
│   │   └── main.py
│   └── tests
│
├── frontend
│   ├── src
│   │   ├── app
│   │   ├── components
│   │   ├── features
│   │   ├── layouts
│   │   ├── pages
│   │   ├── services
│   │   └── styles
│   └── public
│
├── docs
├── README.md
├── .gitignore
└── CHANGELOG.md
```

---

## Geliştirme Disiplini

Her çalışmaya başlamadan önce:

```powershell
cd C:\via
git status
git pull
```

Her çalışma bittikten sonra:

```powershell
cd C:\via
git status
git add .
git commit -m "Aciklayici commit mesaji"
git push
```

Ana kural:

Ev bilgisayarı ve iş bilgisayarı aynı GitHub reposundan çalışacaktır. Her çalışmadan önce `git pull`, her çalışmadan sonra `git push` yapılacaktır.

---

## Proje Kuralları

1. Her değişiklik kontrollü ve anlaşılır yapılacaktır.
2. Kullanıcı onayı olmadan büyük refactor yapılmayacaktır.
3. Fonksiyon, dosya ve değişken adları gereksiz yere değiştirilmeyecektir.
4. Çalışan yapı bozulmayacaktır.
5. Her adım sonunda test adımları verilecektir.
6. Uzun kodlarda patch/diff yerine tam nihai dosya tercih edilecektir.
7. Yeni dosyanın konumu açıkça belirtilecektir.
8. Acemi kullanıcıya uygun, sade ve adım adım açıklama yapılacaktır.
9. Gereksiz tekrar yapılmayacaktır.
10. Güvenlik, muhasebe doğruluğu ve veri bütünlüğü öncelikli olacaktır.

---

## İlk Kullanıcı Rolleri

- Super Admin
- Ortak / Manager
- Muhasebe
- Operasyon Sorumlusu
- Viewer / Rapor Kullanıcısı

---

## Ana Modüller

1. Giriş / Yetkilendirme
2. Kullanıcı ve rol yönetimi
3. Dashboard
4. Müşteri yönetimi
5. Sanatçı / grup / dansçı / hizmet yönetimi
6. Etkinlik yönetimi
7. Teklif ve anlaşma yönetimi
8. Ödeme planı
9. Tahsilat yönetimi
10. Ana kasa / banka aktarım onayı
11. Gider yönetimi
12. Sezonluk / dağıtılmış gider yönetimi
13. Operasyon yönetimi
14. Rider / kulis şartları kontrolü
15. Ortak hesapları
16. Aylık dönem kapanışı
17. Raporlar
18. Sistem ayarları
19. İşlem geçmişi / audit log
20. PDF ve belge çıktıları

---

## Para Birimi Mantığı

Her parasal işlemde şu bilgiler tutulacaktır:

- Orijinal tutar
- Orijinal para birimi
- İşlem kuru
- Ana para birimindeki karşılık
- Kur tarihi
- Kur manuel mi otomatik mi?
- Açıklama

İşlem tarihinde kullanılan kur sabitlenmelidir. Geçmiş kayıtlar sonradan kur değişti diye otomatik değişmemelidir.

---

## Faturalı / Faturasız İşlem Mantığı

Her etkinlikte faturalı veya faturasız seçimi zorunlu olacaktır.

Faturalı işlemlerde fiyatlar KDV hariç kabul edilir.

KDV oranı:

```text
%16
```

KDV kâr değildir.

---

## Tahsilat Mantığı

Tahsilatı ortaklardan biri, manager, muhasebe personeli veya yetkili başka bir kullanıcı alabilir.

Tahsilat ana kasaya geçmediyse sistemde ilgili kişinin üzerinde görünmelidir.

Bu yapı ortaklar arası ay sonu mahsuplaşma için zorunludur.

---

## Gider Mantığı

Giderler üç ana gruba ayrılacaktır:

1. Etkinliğe bağlı gider
2. Genel aylık gider
3. Dağıtılmış sezonluk / yıllık gider

Dağıtılmış giderlerde gider başlangıç ve bitiş ayları arasında eşit paylaştırılacaktır.

---

## Kârlılık Hesabı

Etkinlik bazlı net kâr:

```text
Etkinlik Net Kârı =
KDV hariç gelir
- sanatçı maliyeti
- etkinlik operasyon giderleri
- etkinliğe bağlı primler
- etkinliğe bağlı diğer giderler
```

Aylık şirket net kârı:

```text
Aylık Net Kâr =
Tüm etkinliklerden gelen net kâr
- genel aylık giderler
- o aya düşen dağıtılmış sezonluk/yıllık giderler
```

Ortak başı kâr:

```text
Ortak Başı Kâr =
Aylık Net Kâr / 3
```

---

## Dönem Kapanışı

Her ay sonunda dönem kapanışı yapılacaktır.

Kapanıştan önce sistem şu kontrolleri yapmalıdır:

- Eksik tahsilat var mı?
- Gecikmiş ödeme var mı?
- Ana kasaya aktarılmamış tahsilat var mı?
- Onaysız gider var mı?
- Belgesiz kasa aktarımı var mı?
- Faturalı/faturasız seçimi eksik etkinlik var mı?
- Kuru eksik para birimi işlemi var mı?
- Operasyon raporu tamamlanmamış etkinlik var mı?
- Ortak üzerinde para var mı?

Kapanış yapıldıktan sonra ilgili dönem kilitlenmelidir.

---

## Geliştirme Önceliği

1. Doğru iş mantığı
2. Güvenli veri yapısı
3. Sağlam muhasebe hesabı
4. Mobil uyumlu kullanıcı deneyimi
5. Raporlama
6. Görsel kalite
7. Canlıya alma
