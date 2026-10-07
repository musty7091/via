# VIA EVENTS — Proje Röntgeni (Ekim 2026)

Bu doküman, Haziran 2026'da bırakılan kod tabanının satır satır incelenmesiyle hazırlanmıştır.
Amaç: projenin ne olduğunu, nerede kaldığını, neyin çalışıp neyin bozuk olduğunu tek yerde toplamak
ve modern yeniden tasarıma temel oluşturmak.

> Not: Veritabanlarındaki tüm veriler demo verisidir. Yeniden tasarımda veri taşıma gerekmez.

---

## 1. Proje Nedir?

3 ortaklı bir etkinlik/organizasyon şirketinin (KKTC) operasyon ve ön muhasebe sistemi.
Ortaklardan biri iş getirir, kâr 3 ortak arasında bölünür. Tahsilatı ortaklardan biri alabilir;
para şirket kasasına geçene kadar o ortağın üzerinde görünmelidir. Ay sonunda dönem kapanır,
açık kalemler (alacak, borç, ortak üzerindeki para) bir sonraki aya devreder.

Ana akış:

```
Katalog (sanatçı, hizmet, paket)
  → Teklif (taslak → gönderildi → kabul)
  → Anlaşmaya çevir → Etkinlik dosyası
  → Ödeme planı → Tahsilat (şirket kasası veya ortak üzerinde)
  → Sanatçı/hizmet borcu → Ödeme
  → Giderler (dönem / sezonluk)
  → Etkinlik finans kapanışı
  → Aylık dönem kapanışı → Devreden kalemler → Sonraki ayda mahsup
  → Ortak kâr payı
```

## 2. Teknoloji (mevcut)

| Katman | Teknoloji |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Pydantic, JWT (python-jose), bcrypt |
| Veritabanı | SQLite (canlı hedef: PostgreSQL, Cloud Run) — migration yok |
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind 4 — router/kütüphane yok |

Ölçek: ~37 tablo, 92 API endpoint, 16 backend modülü, 7 frontend modülü, ~40 bin satır.
Son çalışma 8 Haziran 2026 (2–8 Haziran arası 80 commit).

## 3. Ne Var? (modül modül)

| Modül | Backend | Frontend | Durum |
|---|---|---|---|
| Giriş / JWT | ✓ | ✓ | Çalışıyor, token süresi dolunca yakalanmıyor |
| Kullanıcı yönetimi | ✓ (sadece super_admin) | ✓ | Çalışıyor |
| Ortaklar | ✓ | ✓ | Çalışıyor, herkes yüzde değiştirebiliyor |
| Müşteriler + yetkili + mekân + cari | ✓ | ✓ | Düzenleme/pasife alma yok; cari elle tutuluyor |
| Hizmet kataloğu (sanatçı, hizmet, paket, rider şablonu) | ✓ | ✓ | Düzenleme yok |
| Teklifler (+ yazdırma) | ✓ | ✓ | Çalışıyor, durum geçişleri kuralsız |
| Etkinlikler | Sadece okuma | ✓ | Oluşturma/düzenleme/iptal yok |
| Ödeme planı + tahsilat + ortaktan teslim | ✓ | ✓ | Çalışıyor, ciddi hatalar var (bkz. 5) |
| Giderler (dönem / sezonluk dağıtım) | ✓ | ✓ | Etkinliğe bağlı gider ekranı yok |
| Sanatçı/hizmet borçları + ödemeler | ✓ | ✓ | Borç oluşturma ekranı yok |
| Ortak hesapları, tedarikçi ekstreleri | ✓ | Kısmen | |
| Etkinlik finans kapanışı | ✓ | ✓ | Devreden kalemle kapanamıyor |
| Dönem kapanışı + rapor + PDF | ✓ | ✓ | Kilit diğer modüllerde uygulanmıyor |
| Devreden kalem mahsubu | ✓ | ✓ | İsim yerine ID gösteriyor |
| Operasyon görevleri, rider kontrolü | Sadece tablo | ✗ | Yapılmamış |
| Audit log | Sadece tablo | ✗ | Hiçbir şey yazmıyor |
| Döviz kurları tablosu | Sadece tablo | ✗ | Kur her kayıtta elle |
| Dashboard / raporlar (sanatçı, aylık kârlılık) | ✗ | Basit kartlar | Yapılmamış |
| Halka açık "Events" vitrini | ✗ | Tıklanmayan kart | Yapılmamış |
| PostgreSQL / Alembic / Cloud Run | ✗ | — | Başlanmamış |
| Testler | 4 smoke script (pytest çalıştırmaz) | 4 sahte kontrol | Pratikte yok |

## 4. Doğru Kurgulanmış Olanlar (korunacak)

- İş kuralları dokümanları (özellikle `FINANCE_CARRY_FORWARD_RULES_V1.md`, `FINANCE_CENTER_UX_WORKFLOW_DECISIONS_V1.md`) çok sağlam.
- Merkezi finans hareketi fikri, devreden kalem modeli, etkinlik kapanışı / dönem kapanışı ayrımı.
- Paket fiyatlama (paket satış fiyatı tek kalem, içerik müşteriye fiyatsız).
- Kur sabitleme kuralı, silme yerine iptal kuralı, kapanmış dönemin değişmemesi kuralı.
- Muhasebeciye teknik terim göstermeme, her kritik işlemde onay penceresi prensibi.
- KDV %16 (KKTC standart oranı — doğru).

## 5. Kritik Hatalar

### Güvenlik
1. **Rol sistemi çalışmıyor.** Sadece `/users` korunuyor. `viewer` dahil herkes tahsilat girebilir/iptal edebilir, dönem kapatabilir, ortak yüzdelerini değiştirebilir.
2. Varsayılan admin şifresi (`Via12345!`) giriş ekranında önceden dolu ve ekranda yazılı; SECRET_KEY varsayılan.
3. Giriş denemesi sınırı yok, token iptal edilemiyor, şifre en az 6 karakter.
4. Audit log hiç yazılmıyor — finansal değişikliklerin izi yok.

### Muhasebe doğruluğu
5. **Döviz hiç çevrilmiyor.** EUR teklif → etkinlik `base_agreement_amount` = EUR rakamı, kur = 1. Tüm TL raporları EUR etkinliklerde yanlış.
6. **Aktarılmış tahsilat iptal edilince** ortak bakiyesi eksiye düşüyor, şirket kasası azalmıyor.
7. **Dönem kilidi uygulanmıyor.** Kapalı aya tahsilat, gider, ödeme girilebiliyor; iptal ters kaydı eski tarihe (kapalı aya) yazılıyor.
8. **Zarar kaybolur.** Zararlı ayda ortaklara hiçbir kayıt yazılmıyor; kârlı ayda pay dağıtılıyor.
9. **Ortak payı 33,3333 × 3 = %99,9999** — her ay küsurat kayboluyor; yüzde toplamı kontrol edilmiyor.
10. **Kâr anlaşma tutarı üzerinden (tahakkuk)** hesaplanıp dağıtılıyor; dokümandaki "tahsil edilmeden gerçek kâr yok" kuralına aykırı.
11. Etkinliğe bağlı sezonluk gider iki kez sayılıyor.
12. Ortağın cebinden ödediği gider, ortağın şirketten alacağına yazılmıyor.
13. Müşteri cari hesabı akıştan beslenmiyor (iki ayrı gerçeklik kaynağı).
14. Para hesapları `float` ile; 2 ve 4 hane yuvarlama karışık; kuruş farkları sessizce siliniyor.
15. Eşzamanlı işlemlerde çift kayıt riski (kilit/unique yok).
16. İki ekranda ortak bakiyesi ters işaretle gösteriliyor.

### Veri ve altyapı
17. `init_db` her çalıştığında tüm tabloları siliyor; kökteki demo script'i yanlış dosyayı yedekleyip asıl DB'yi siliyor.
18. DB yolu çalışılan klasöre göre değişiyor → iki farklı `via_events.db` oluşmuş; kökteki git-ignore'da değil.
19. Foreign key'ler SQLite'ta kapalı; modellerde hiç `relationship` yok.
20. 9 tablo hiç kullanılmıyor (audit, currency_rates, documents, operation_tasks, rider_checks, ...).

### Frontend
21. Router yok; seçili kayıt URL'de değil; global menü yok, her sayfa çıkmaz sokak.
22. Finans Merkezi tek sayfa (2.542 satır) ve açılışta 1.500+ istek atabiliyor (N+1).
23. Ortak bileşen yok: `formatMoney` 11, `parseApiError` 9 kez kopyalanmış.
24. TL karşılığı, orijinal para birimi etiketiyle gösteriliyor ("35.000 EUR" aslında 35.000 TL).
25. Bazı formlar hatayı yutuyor; kritik işlemlerin bir kısmında onay yok; `window.prompt` kullanılıyor.
26. Tarih "bugün" UTC'ye göre hesaplanıyor (gece 00–03 arası dünün tarihi).
27. Marka uyumsuz: logo lacivert, arayüz teal/slate; logo görselleri kullanılmıyor.

## 6. Dokümanlar Arası Çelişkiler

| Konu | A | B |
|---|---|---|
| Ortak paylaşımı | Eşit /3 (README) | Düzenlenebilir yüzde (PARTNERS) |
| Kâr tanımı | Anlaşma tutarı bazlı (README) | Tahsilat bazlı gerçek kâr (CARRY_FORWARD) |
| Dönem kapanış engelleri | 9 ön kontrol (README) | Sadece "zaten kapalı" (PERIOD_CLOSING V1) |
| Açık borçla etkinlik kapanışı | Yasak (UX §7) | Devredilerek mümkün (CARRY_FORWARD §14.1) |
| Sezonluk gider bitişi | Aralık sabit (EXPENSE) | Kullanıcı seçer (UX) |
| Migration | Alembic (README) | Yok (README_BACKEND) |
| Devreden kalem tipleri | 9 tip | 5 tip uygulanmış |

## 7. Ekranlar (mevcut)

- **Açılış:** Koyu ekran, 3 kart: Events (çalışmıyor), Operations Center, Finance Center. Telefon: 0539 114 90 90.
- **Dashboard:** 7 modül kartı, KPI yok.
- **Müşteriler:** Arama/seçici + detay: yetkililer, mekânlar, cari hareketler (elle).
- **Hizmet Kataloğu:** Sanatçı / Teknik hizmet / Program paketi sekmeleri; paket program akışı; rider şablonu.
- **Teklifler:** Liste + detay, paket içe aktarma, manuel kalem, iç kârlılık, yazdırma, anlaşmaya çevirme.
- **Etkinlikler:** Liste + detay; ödeme planı, tahsilatlar, kalemler.
- **Ortaklar:** Yüzde yönetimi.
- **Kullanıcılar:** Super admin için CRUD + şifre sıfırlama.
- **Finans Merkezi:** Özet kartlar, bugün yapılacaklar, hızlı işlemler (tahsilat, gider, tedarikçi ödemesi),
  tahsilat takibi, borç takibi, gider takibi, dönem kapanış raporu (+PDF), etkinlik finans kapanışı,
  devreden kalem mahsubu, son hareketler.

## 8. Sahibin Onayladığı Kararlar (5 Ekim 2026)

1. **Kâr paylaşımı:** Her zaman eşit 1/3. Bölünemeyen kuruş sırayla bir ortağa yazılır, kaybolmaz.
2. **Kâr zamanı:** Ortak kârı, etkinlik tahsil edilip finansal olarak kapandığında dağıtılabilir olur.
3. **Zarar:** Zarar da ortaklara bölünür, ortak hesabına eksi yazılır ve sonraki kârlardan düşülür.
4. **Vitrin sitesi:** Projenin parçası, ama yönetim paneli bittikten sonraki aşamada.
5. **KDV:** %16 (KKTC). Para birimleri: TRY, EUR, GBP, USD.
6. **Yaklaşım:** Python/FastAPI + React korunur, kod temiz bir temelle yeniden yazılır. Mevcut veriler demo olduğu için taşınmaz.
7. **Roller (5 Ekim 2026):** Sistemin tek süper admini Mustafa Karadeniz'dir; ortak değildir ve kâr paylaşımına katılmaz.
   - **Süper Admin:** Her şey. Finans onayı, dönem kapatma, ortak/kullanıcı/ayar yönetimi sadece buradadır.
   - **Ortak:** Her şeyi görür (finans, maliyet, kârlılık, tüm ortak hesapları). Müşteri, teklif, etkinlik ve katalog yönetir. Finans kaydı, onay ve kapanış yapamaz.
   - **Muhasebe:** Her şeyi görür, finans kaydı girer (tahsilat, gider, ödeme), onay veremez.
   - **Operasyon:** Etkinlik operasyonu; maliyet ve finans görmez.
   - **İzleyici:** Sadece görüntüler.
   Rol tablosu: `apps/api/app/core/permissions.py`, kilitleyen testler: `apps/api/tests/test_permissions.py`.

## 9. Sahibin Onayladığı Kararlar (7 Ekim 2026)

1. **Kâr ayı:** Etkinlik kârı/zararı etkinliğin yapıldığı aya yazılır (kapanışın yapıldığı güne değil).
   Bu yüzden bir ayın dönemi, o ayın etkinliklerinin finans kapanışı yapılmadan kapatılamaz.
   Etkinlik günü gelmeden finans kapanışı yapılamaz.
2. **Kapora:** İptal edilen etkinlikte alınan para geri verilmez; şirkette kalır ve etkinlik geliri
   olur. İstisnai durumda iptal sırasında bir kısmı veya tamamı müşteriye iade edilir (finans kayıt
   yetkisi gerekir). Sanatçı/tedarikçiye yapılmış ödemeler maliyet olarak kalır, ödenmemiş kısımlar
   düşülür. İptal edilen etkinliğin sonucu iptal edildiği aya yazılır ve finans kapanışıyla
   ortaklara dağıtılır (sonuç sıfırsa kapanış gerekmez).
3. **İptal ters kaydı:** Orijinal kaydın dönemi açıksa ters kayıt orijinal tarihe yazılır (kayıt hiç
   olmamış gibi); dönem kapalıysa bugüne. Kasadan para çıkaran geriye tarihli işlemde kasa o tarihten
   bugüne hiçbir gün eksiye düşemez.
4. **Şifre:** Yöneticinin oluşturduğu veya şifresini sıfırladığı kullanıcı ilk girişte kendi şifresini
   belirler; belirlemeden hiçbir ekran ve API kullanılamaz.
