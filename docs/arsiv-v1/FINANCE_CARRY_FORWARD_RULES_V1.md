# VIA EVENTS Finance Carry Forward Rules v1

Bu belge VIA EVENTS muhasebe, devir, dönem kapanışı, ortak hesaplaşması ve kârlılık mantığının ana karar belgesidir.

## 1. Ana prensip

VIA EVENTS içinde finansal etki oluşturan hiçbir işlem tek başına kalmaz.

Her işlem şu alanlardan hangilerini etkilediğine göre otomatik finans zinciri oluşturmalıdır:

- Müşteri cari hesabı
- Etkinlik finansı
- Ödeme planı
- Tahsilat durumu
- Gider / borç durumu
- Kasa / banka bakiyesi
- Ortak üzerindeki para
- Ortağın şirketten alacağı
- Şirketin ortaktan alacağı
- Dönem kapanışı
- Devir kayıtları
- Ortak kâr payı

Temel kural:

> Dönem kapanışı açık hesapları kapatmaz; açık hesapları sonraki döneme kontrollü şekilde devreder.

İkinci temel kural:

> Tahsil edilmemiş alacak, ödenmemiş borç veya ortak üzerinde kalan para varken etkinlik finansal olarak kapanmış sayılmaz.

Üçüncü temel kural:

> Müşteriden tahsilat yapılmadan gerçek kârlılık oluşmaz. Gerçek kârlılık oluşmadan ortak hesabı kapanmaz. Ortak hesabı kapanmadan dönem kapanışı sağlıklı olmaz.

## 2. Kâr türleri

VIA EVENTS içinde kâr üç farklı seviyede izlenmelidir.

### 2.1 Tahmini kâr

Teklif veya anlaşma aşamasında oluşur.

```text
Anlaşma tutarı - tahmini maliyetler = tahmini kâr
```

Bu kâr bilgi amaçlıdır. Ortaklara dağıtılamaz.

### 2.2 Operasyonel kâr

Etkinlik gerçekleştiğinde ve giderler işlendiğinde oluşur.

```text
Anlaşma tutarı - gerçekleşen giderler = operasyonel kâr
```

Bu kâr hâlâ tahsilat durumuna bağlıdır. Tahsilat tamamlanmadan dağıtılabilir sayılmaz.

### 2.3 Dağıtılabilir gerçek kâr

Sadece şu şartlar tamamlanınca oluşur:

- Müşteri tahsilatı tamamlandı.
- Tüm giderler işlendi.
- Sanatçı / hizmet borçları ödendi veya açık borç olarak devir onayı aldı.
- Ortak üzerinde para kalmadı veya açık emanet olarak devretti.
- Etkinlik finansal kapanış kontrolünden geçti.

```text
Tahsil edilen toplam para - ödenen giderler - açık zorunlu borçlar = dağıtılabilir gerçek kâr
```

## 3. Tekliften etkinliğe finans zinciri

Teklif anlaşmaya döndüğünde sistem şu zinciri oluşturmalıdır:

```text
Teklif
↓
Anlaşma
↓
Etkinlik dosyası
↓
Müşteri borcu
↓
Ödeme planı
↓
Beklenen tahsilat
↓
Tahmini kâr
```

Anlaşmaya dönüşen teklif artık sadece satış belgesi değildir. Finans zincirinin başlangıcıdır.

## 4. Tahsilat kuralı

Tahsilat girildiğinde sistem şu etkileri oluşturmalıdır:

1. Tahsilat kaydı oluşur.
2. Müşteri cari borcu azalır.
3. Bağlı ödeme planı kısmi veya ödendi durumuna geçer.
4. Para nereye geldiyse oraya yazılır:
   - Kasa
   - Banka
   - Ortak üzerindeki para
5. Etkinlik tahsilat durumu güncellenir.
6. Genel finans paneli güncellenir.
7. Ortak hesaplaşması etkilenir.

### 4.1 Ortak tahsilatı

Bir ortak müşteriden para aldıysa bu para doğrudan şirket kasası sayılmaz.

Örnek:

```text
Alper müşteriden 50.000 TL aldı.
```

Doğru kayıt:

```text
Müşteri borcu: 50.000 TL azalır
Şirket kasası: değişmez
Alper üzerindeki şirket parası: 50.000 TL artar
```

Alper parayı şirkete teslim ettiğinde:

```text
Alper üzerindeki para azalır
Kasa veya banka artar
Müşteri cari tekrar etkilenmez
```

## 5. Gider kuralı

Gider girildiğinde sistem şu soruları sormalıdır:

- Gider hangi etkinliğe ait?
- Gider kime ait?
- Gider ödendi mi?
- Gideri kim ödedi?
- Kasa mı ödedi?
- Banka mı ödedi?
- Ortak mı cebinden ödedi?
- Henüz ödenmedi mi?

### 5.1 Şirket kasasından ödenen gider

```text
Etkinlik gideri artar
Kasa/banka azalır
Etkinlik kârı düşer
```

### 5.2 Ortak tarafından ödenen gider

```text
Etkinlik gideri artar
Kasa/banka etkilenmez
Ortağın şirketten alacağı artar
Etkinlik kârı düşer
```

### 5.3 Henüz ödenmemiş gider

```text
Etkinlik gideri ve borç oluşur
Kasa/banka etkilenmez
Sanatçı/hizmet borcu açık kalır
Dönem kapanışında borç devreder
```

## 6. Devir mantığı

Dönem kapanışı tüm hesapları kapatmaz.

Dönem kapanışı şu işlemi yapar:

```text
Geçmiş dönemi kilitler.
Açık kalan alacak, borç, kasa, banka, ortak ve etkinlik bakiyelerini yeni döneme taşır.
```

## 7. Devir türleri

VIA EVENTS içinde en az şu devir türleri izlenmelidir:

- Müşteri alacağı devri
- Sanatçı / hizmet sağlayıcı borcu devri
- Kasa bakiyesi devri
- Banka bakiyesi devri
- Ortak üzerindeki para devri
- Ortağın şirketten alacağı devri
- Şirketin ortaktan alacağı devri
- Kapanmamış etkinlik devri
- Tahsil edilmemiş kâr devri

## 8. Müşteri alacağı devri

Etkinlik yapılmış veya anlaşma oluşmuş ama müşteri tam ödeme yapmamışsa kalan tutar devreder.

Örnek:

```text
Etkinlik: Kaya Wedding
Dönem: Mayıs 2026
Anlaşma: 300.000 TL
Tahsilat: 50.000 TL
Kalan: 250.000 TL
```

Mayıs kapanışı:

```text
Mayıs müşteri alacağı devri: 250.000 TL
Haziran açılış müşteri alacağı: 250.000 TL
```

Alacağın kaynağı korunmalıdır:

- Müşteri
- Etkinlik
- Asıl dönem
- Vade tarihi
- Gecikme günü
- Kalan tutar

## 9. Sanatçı / hizmet borcu devri

Sanatçıya veya hizmet sağlayıcıya ödeme yapılmadıysa borç devreder.

Örnek:

```text
Grup Frekans borcu: 80.000 TL
Ödenen: 30.000 TL
Kalan: 50.000 TL
```

Dönem kapanışı:

```text
Sanatçı borcu devri: 50.000 TL
```

Borç kaynağı korunmalıdır:

- Sanatçı / hizmet sağlayıcı
- Etkinlik
- Asıl dönem
- Kalan borç
- Vade
- Ödeme durumu

## 10. Ortak üzerindeki para devri

Ortak müşteriden para aldı ama şirkete teslim etmediyse bu para devreder.

Örnek:

```text
Alper müşteriden 50.000 TL aldı.
Şirkete teslim etmedi.
```

Dönem kapanışı:

```text
Alper üzerindeki para devri: 50.000 TL
```

Yeni dönemde bu para hâlâ şirketin Alper'den alacağıdır.

## 11. Ortağın şirketten alacağı devri

Ortak kendi cebinden gider ödediyse ve şirket bunu ortağa ödemediyse bu alacak devreder.

Örnek:

```text
Alper teknik ekibe 20.000 TL ödedi.
Şirket Alper'e ödeme yapmadı.
```

Dönem kapanışı:

```text
Alper'in şirketten alacağı devri: 20.000 TL
```

## 12. Kasa ve banka devri

Kasa ve banka için açık kalem değil, bakiye devri oluşur.

Örnek:

```text
Mayıs sonu kasa: 75.000 TL
Mayıs sonu banka: 120.000 TL
```

Haziran açılışı:

```text
Kasa açılış devri: 75.000 TL
Banka açılış devri: 120.000 TL
```

## 13. Etkinlik kapanışı ile dönem kapanışı farkı

Dönem kapanışı ve etkinlik kapanışı farklı kavramlardır.

Bir dönem kapanabilir ama içinde açık etkinlik olabilir.

Örnek:

```text
Mayıs dönemi kapandı.
Kaya Wedding tahsilatı tamamlanmadı.
```

Doğru durum:

```text
Mayıs dönemi kilitlenir.
Kaya Wedding açık etkinlik olarak sonraki döneme devreder.
```

Etkinlik ancak şu şartlarda finansal olarak kapanabilir:

- Müşteri tahsilatı tamamlandı.
- Tüm giderler işlendi.
- Sanatçı / hizmet borçları kapandı veya onaylı açık borç olarak devretti.
- Ortak üzerindeki para kapandı veya açık emanet olarak devretti.
- Net kâr hesaplandı.
- Ortak payı hesaplandı.
- Kapanış onayı verildi.

## 14. Her etkinlik için finansal kapanış onayı

Her etkinlik kendi içinde ayrı bir finansal dosya gibi düşünülmelidir.

Dönem kapanışı ayı kapatır. Etkinlik finansal kapanışı ise o etkinliğin tahsilat, gider, borç, ortak ve kâr hesabını kapatır.

Bu yüzden bir etkinlik finansal kapanış onayı almadan:

- Ortak kârı kesinleşmez.
- Dağıtılabilir gerçek kâr oluşmaz.
- Dönem kapanışı tam güvenilir olmaz.
- Açık alacak, açık borç ve devir kayıtları netleşmez.
- Ortak hesaplaşması kesin sonuç üretmez.

### 14.1 Etkinlik finansal kapanış ön koşulları

Bir etkinliğin finansal olarak kapanabilmesi için şu kontroller tamamlanmalıdır:

1. Anlaşma tutarı kesinleşmiş olmalıdır.
2. Ödeme planı anlaşma tutarıyla uyumlu olmalıdır.
3. Müşteri tahsilatı tamamlanmış olmalıdır veya kalan tutar için yetkili kullanıcı tarafından şu kararlardan biri verilmelidir:
   - Açık alacak olarak devret
   - Zarar / tahsil edilemez olarak işaretle
   - Yönetici onaylı açık takipte bırak
4. Tüm sanatçı ve hizmet maliyetleri girilmiş olmalıdır.
5. Tüm etkinlik giderleri işlenmiş olmalıdır.
6. Sanatçı / hizmet sağlayıcı borçları şu durumlardan birinde olmalıdır:
   - Ödendi
   - Sonraki döneme devretti
   - Yetkili onaylı açık borç olarak kaldı
7. Ortak üzerinde şirket parası varsa şu durumlardan birinde olmalıdır:
   - Şirkete teslim edildi
   - Sonraki döneme açık emanet olarak devretti
8. Kasa, banka ve ortak üzerindeki para hareketleri kontrol edilmiş olmalıdır.
9. Net kâr hesaplanmış olmalıdır.
10. Ortak payları hesaplanmış olmalıdır.
11. Yetkili kullanıcı etkinlik finansal kapanış onayı vermiş olmalıdır.

### 14.2 Etkinlik finansal kapanış statüleri

Etkinlik finansal kapanış süreci en az şu statülerle izlenmelidir:

- `open`: Etkinlik finansal olarak açık.
- `ready_for_review`: Muhasebe kontrolleri tamamlandı, onay bekliyor.
- `closed`: Finansal kapanış onaylandı.
- `carried_forward`: Etkinlik kapanmadı, açık kalemleriyle sonraki döneme devretti.
- `reopened`: Daha önce kapatılmış etkinlik yetkili kullanıcı tarafından yeniden açıldı.

### 14.3 Kapanış onayı verildiğinde oluşacak sonuçlar

Etkinlik finansal kapanış onayı verildiğinde sistem şu sonuçları üretmelidir:

- Etkinlik finansal kapanış kaydı oluşur.
- Kapanış anındaki finansal özet kilitlenir.
- Net kâr ve ortak payları kayıt altına alınır.
- Açık alacak / borç varsa gerekçesiyle birlikte görünür.
- Dağıtılabilir gerçek kâr ancak uygun şartlar sağlandıysa oluşur.
- Dönem kapanışı bu etkinliği kapalı etkinlik olarak görebilir.
- Sonradan değişiklik gerekirse normal kullanıcı doğrudan değiştiremez; düzeltme veya yeniden açma yetkili kullanıcı kontrolünde yapılır.

### 14.4 Kapanamayan etkinliklerin dönem devri

Bir etkinlik finansal kapanış onayı alamıyorsa dönem kapanışında silinmez veya sıfırlanmaz.

Bu etkinlik şu bilgilerle sonraki döneme devreder:

- Etkinlik
- Müşteri
- Asıl dönem
- Devir dönemi
- Kalan müşteri alacağı
- Kalan sanatçı / hizmet borcu
- Ortak üzerindeki para
- Ortağın şirketten alacağı
- Şirketin ortaktan alacağı
- Tahsil edilmemiş kâr
- Devir nedeni
- Yetkili onay bilgisi

### 14.5 Yetki kuralı

Etkinlik finansal kapanışını herkes yapamaz.

Önerilen yetki kuralı:

- Muhasebe kullanıcısı kapanış hazırlığı yapabilir.
- Operasyon kullanıcısı gider ve maliyet eksiklerini tamamlayabilir.
- Partner kullanıcı kendi üzerindeki para ve masraf kayıtlarını görebilir.
- Sadece yetkili yönetici / super admin finansal kapanış onayı verebilir.
- Kapanmış etkinliği yeniden açma yetkisi sadece super admin seviyesinde olmalıdır.

## 15. Dönem kapanış kontrol listesi

Dönem kapanışı ekranı kullanıcıya şu bilgileri göstermelidir:

- Kasa kapanış bakiyesi
- Banka kapanış bakiyesi
- Devreden müşteri alacakları
- Devreden sanatçı / hizmet borçları
- Ortak üzerindeki para
- Ortakların şirketten alacağı
- Şirketin ortaklardan alacağı
- Açık etkinlik sayısı
- Tahsilatı geciken etkinlikler
- Ödemesi geciken borçlar
- Kapanmamış ortak emanetleri
- Finansal kapanış onayı almamış etkinlikler
- Dağıtılabilir gerçek kâr toplamı
- Henüz dağıtılamayan tahmini / operasyonel kâr toplamı

Kullanıcı ancak bu özeti görüp onayladıktan sonra dönemi kapatmalıdır.

## 16. Dönem kilitleme

Dönem kapandıktan sonra geçmiş dönemdeki finans hareketleri değiştirilememelidir.

Düzeltme gerekiyorsa:

- Super admin yetkisi gerekir.
- Dönem yeniden açılır veya düzeltme fişi yeni dönemde işlenir.
- Her düzeltme audit log'a yazılır.

## 17. Finance Center mimari geliştirme sırası

Finans modülü şu sırayla geliştirilmelidir:

1. Finans ve devir kuralları belgesi
2. Finans hareket motoru veri modeli
3. Dönem modeli
4. Açık kalem devir modeli
5. Etkinlik finansal kapanış modeli
6. Müşteri cari ekranı
7. Kasa / banka / ortak üzerindeki para ekranı
8. Sanatçı / hizmet borç ekranı
9. Ortak hesaplaşması
10. Dönem kapanışı ve devir oluşturma

Bu sıra önemlidir. Çünkü ekranlardan önce para hareketlerinin doğru veri modeline oturması gerekir. Önce motor, sonra ekran. Yoksa uygulama güzel görünür ama muhasebe tarafında freni patlamış minibüse döner.

## 18. Finance Center veri modeli için ilk taslak kararlar

İlk kodlama adımına geçmeden önce aşağıdaki veri modeli kararları korunmalıdır.

### 18.1 Finans hareket motoru

Her para etkileyen işlem merkezi bir finans hareket kaydı üretmelidir.

Örnek işlem kaynakları:

- Teklifin anlaşmaya dönüşmesi
- Tahsilat girişi
- Tahsilatın ortağın üzerinde kalması
- Ortağın parayı şirkete teslim etmesi
- Etkinlik gideri
- Ortak cebinden gider ödemesi
- Sanatçı / hizmet borcu oluşması
- Borç ödemesi
- Devir kaydı
- Düzeltme fişi

### 18.2 Dönem modeli

Dönem modeli sadece ay bilgisini tutmamalıdır.

Dönem şunları bilmelidir:

- Dönem ayı
- Durum
- Açılış bakiyeleri
- Kapanış bakiyeleri
- Devreden alacaklar
- Devreden borçlar
- Devreden ortak bakiyeleri
- Dönem net kârı
- Dağıtılabilir gerçek kâr
- Kapanış onayı
- Kilit durumu

### 18.3 Açık kalem devir modeli

Açık kalem devir modeli, dönem kapanışında sıfırlanmayan her kalemi kaynak ilişkisiyle taşımalıdır.

Her devir kaydında en az şu bilgiler olmalıdır:

- Devir türü
- Kaynak dönem
- Hedef dönem
- Müşteri / etkinlik / ortak / sanatçı / hizmet ilişkisi
- Tutar
- Para birimi
- Ana para birimi karşılığı
- Açık kalan neden
- Yetkili onay bilgisi
- Kapanıp kapanmadığı

### 18.4 Etkinlik finansal kapanış modeli

Etkinlik finansal kapanış modeli, kapanış anındaki sonucu dondurmalıdır.

Bu modelde en az şu bilgiler olmalıdır:

- Etkinlik
- Kapanış durumu
- Anlaşma tutarı
- Tahsil edilen tutar
- Kalan müşteri alacağı
- Toplam gider
- Kalan sanatçı / hizmet borcu
- Ortak üzerindeki para
- Net kâr
- Dağıtılabilir gerçek kâr
- Ortak payları
- Kapanış onayı veren kullanıcı
- Kapanış tarihi
- Notlar
- Yeniden açıldıysa yeniden açma nedeni

## 19. Nihai hedef

Finance Center sadece rapor ekranı değildir.

Finance Center şu sorulara tek merkezden cevap vermelidir:

- Kimden ne kadar alacağımız var?
- Kime ne kadar borcumuz var?
- Hangi etkinlik kârlı?
- Hangi etkinlik tahsil edilmediği için kapanamıyor?
- Hangi ortak üzerinde şirket parası var?
- Hangi ortağın şirketten alacağı var?
- Kasa ve bankada gerçek para ne kadar?
- Hangi dönem kapandı?
- Hangi açık kalemler devretti?
- Ortaklara dağıtılabilir gerçek kâr ne kadar?
