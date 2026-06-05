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

## 14. Dönem kapanış kontrol listesi

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

Kullanıcı ancak bu özeti görüp onayladıktan sonra dönemi kapatmalıdır.

## 15. Dönem kilitleme

Dönem kapandıktan sonra geçmiş dönemdeki finans hareketleri değiştirilememelidir.

Düzeltme gerekiyorsa:

- Super admin yetkisi gerekir.
- Dönem yeniden açılır veya düzeltme fişi yeni dönemde işlenir.
- Her düzeltme audit log'a yazılır.

## 16. İlk uygulama sırası

Finans modülü şu sırayla geliştirilmelidir:

1. Finans ve devir kuralları belgesi
2. Finans hareket motoru veri modeli
3. Dönem modeli
4. Açık kalem devir modeli
5. Müşteri cari ekranı
6. Etkinlik finans kapanış kontrolü
7. Kasa / banka / ortak üzerindeki para ekranı
8. Sanatçı / hizmet borç ekranı
9. Ortak hesaplaşması
10. Dönem kapanışı ve devir oluşturma

## 17. Nihai hedef

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
