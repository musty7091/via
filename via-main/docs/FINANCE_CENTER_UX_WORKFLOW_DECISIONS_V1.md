# VIA EVENTS Finans Merkezi Kullanıcı Deneyimi ve Muhasebe İş Akışı Kararları V1

Bu doküman VIA EVENTS projesinde Finans Merkezi modülünün ürün, kullanıcı deneyimi ve muhasebe iş akışı kararlarını tarif eder.

Bu doküman frontend kodlama sürecinde ana referans olarak kullanılacaktır.

---

## 1. Ana Ürün Kararı

Finans Merkezi teknik bir geliştirici ekranı olmayacaktır.

Finans Merkezi, muhasebe elemanının günlük işlerini güvenli, sade ve hatasız şekilde yapacağı profesyonel bir ön muhasebe programı gibi çalışacaktır.

Kullanıcı ekranda teknik terimler, veritabanı mantığı veya API mantığı görmeyecektir.

Kullanıcı sadece gerçek hayattaki işlemi girecektir.

Sistem arka planda şunları kendisi yönetecektir:

- Kasa ve banka hareketleri
- Müşteri cari hareketleri
- Sanatçı / hizmet sağlayıcı cari hareketleri
- Ortak cari hareketleri
- Devreden kalemler
- Etkinlik finans kapanışı
- Dönem kapanışı
- Sezonluk gider dağıtımı
- Kâr etkisi
- Denetim izi

---

## 2. Ana Prensip

Kullanıcı sadece gerçek hayattaki işlemi girer.

Sistem arkadaki muhasebe, cari, kasa, devir, dönem ve kâr etkilerini kendisi yönetir.

Örnek:

Kullanıcı şunu girer:

> Müşteriden 10.000 TL tahsil edildi.

Sistem arka planda şunları yapar:

- Kasa / banka artar
- Müşteri alacağı azalır
- Gerekirse devreden kalem kapanır
- Geçmiş dönem raporu değişmez
- Yeni dönem kârı yanlış artmaz
- Finans hareketi oluşur
- Cari ekstre güncellenir
- Denetim izi korunur

---

## 3. Finans Merkezi'nin Hedef Kullanıcısı

Ana kullanıcı: Muhasebe elemanı.

Bu kullanıcı:

- Her gün tahsilat girer
- Ödeme yapar
- Gider faturası girer
- Sezonluk giderleri takip eder
- Sanatçı / hizmet borçlarını takip eder
- Müşteri alacaklarını takip eder
- Ortak üzerindeki paraları takip eder
- Devreden kalemleri kapatır
- Dönem kapanışına hazırlık yapar

Kullanıcıdan teknik muhasebe motorunu anlaması beklenmeyecektir.

Sistem kullanıcıyı yönlendirecektir.

---

## 4. Kullanıcıya Gösterilmeyecek Teknik Terimler

Aşağıdaki terimler ekranda doğrudan gösterilmeyecektir:

- financial_movement
- carry_forward_item
- allocation
- event_financial_closure
- period_closing
- profit_effect
- cash_effect
- partner_effect
- source_reference_type
- source_reference_id
- base_amount
- movement_group_key

Bunların yerine kullanıcı dostu Türkçe karşılıklar kullanılacaktır:

| Teknik Terim | Ekranda Görünecek Karşılık |
|---|---|
| financial_movement | Finans Hareketi |
| carry_forward_item | Devreden Kalem |
| allocation | Sezonluk Gider Payı |
| event_financial_closure | Etkinlik Finans Kapanışı |
| period_closing | Dönem Kapanışı |
| profit_effect none | Yeni Dönem Kârını Etkilemez |
| partner_cash_on_hand | Ortağın Üzerindeki Para |
| company_payable_to_partner | Şirketin Ortağa Borcu |
| customer_receivable | Müşteri Alacağı |
| supplier_payable | Sanatçı / Hizmet Borcu |

---

## 5. Uyarı ve Onay Prensibi

Finans Merkezi'nde kritik işlemler kullanıcının açık onayı olmadan yapılmayacaktır.

Her kritik işlemden önce sade, anlaşılır ve iş sonucunu açıklayan onay sorusu gösterilecektir.

Uyarı pencereleri korkutucu değil, açıklayıcı olacaktır.

Uyarı metni şu üç soruyu cevaplamalıdır:

1. Bu işlem ne yapacak?
2. Hangi kayıtları etkileyecek?
3. Eski dönem / yeni dönem / kâr etkisi ne olacak?

---

## 6. Standart Uyarı Örnekleri

### 6.1 Geçmiş Dönem Alacağı Tahsilatı

Başlık:

> Devreden Müşteri Alacağı Kapatılacak

Mesaj:

> Bu tahsilat geçmiş dönemden devreden müşteri alacağını kapatacak.
>
> Eski dönem raporu değişmeyecek.
>
> Bu işlem yeni dönem kârını artırmayacak.
>
> Devam etmek istiyor musunuz?

Butonlar:

- Vazgeç
- Tahsilatı Kaydet

---

### 6.2 Sanatçı / Hizmet Borcu Ödemesi

Başlık:

> Devreden Sanatçı / Hizmet Borcu Ödenecek

Mesaj:

> Bu ödeme geçmiş dönemden devreden sanatçı / hizmet borcunu kapatacak.
>
> Şirket kasa / banka çıkışı oluşacak.
>
> Eski dönem gideri değişmeyecek.
>
> Bu işlem yeni dönem giderini artırmayacak.
>
> Devam etmek istiyor musunuz?

Butonlar:

- Vazgeç
- Ödemeyi Kaydet

---

### 6.3 Sezonluk Gider Kaydı

Başlık:

> Sezonluk Gider Aylara Dağıtılacak

Mesaj:

> Bu gider sezonluk gider olarak kaydedilecek.
>
> Gider, seçilen başlangıç ayından sezon sonuna kadar aylara bölünecek.
>
> Her dönem sadece kendisine düşen gider payını alacak.
>
> Devam etmek istiyor musunuz?

Örnek detay:

> Toplam gider: 70.000 TL
>
> Dönem aralığı: Haziran - Aralık
>
> Ay sayısı: 7
>
> Her aya düşen pay: 10.000 TL

Butonlar:

- Vazgeç
- Sezonluk Gideri Kaydet

---

### 6.4 Dönem Kapanışı

Başlık:

> Dönem Kapatılacak

Mesaj:

> Bu dönem kapatılacak ve kilitlenecek.
>
> Açık müşteri alacakları, sanatçı / hizmet borçları, ortak üzerindeki paralar ve açık etkinlikler sonraki döneme devredilecek.
>
> Kapanan döneme normal işlem girilemeyecek.
>
> Devam etmek istiyor musunuz?

Butonlar:

- Vazgeç
- Dönemi Kapat

---

### 6.5 Etkinlik Finans Kapanışı

Başlık:

> Etkinlik Finans Kapanışı Yapılacak

Mesaj:

> Bu etkinlik finansal olarak kapatılacak.
>
> Tahsilatlar, giderler, sanatçı / hizmet borçları ve ortak hareketleri kontrol edilecek.
>
> Kapanış sonrası etkinliğin gerçek kârı ve ortak payları hesaplanacak.
>
> Devam etmek istiyor musunuz?

Butonlar:

- Vazgeç
- Etkinliği Kapat

---

## 7. Hata Önleme Kuralları

Finans Merkezi kullanıcıya hata yaptırmamalıdır.

Aşağıdaki durumlarda işlem doğrudan engellenmelidir:

- Kapalı dönem üzerine normal işlem girilmek istenirse
- Kapanmış devreden kalem tekrar kapatılmak istenirse
- Kapanmış sanatçı / hizmet borcuna ikinci ödeme yapılmak istenirse
- Tahsilatı tamamlanmamış etkinlik kâr dağıtımına alınmak istenirse
- Açık sanatçı / hizmet borcu olan etkinlik kapatılmak istenirse
- Ortağın üzerinde para varken dönem kapanışında bu durum gizlenmeye çalışılırsa
- Sezonluk giderde bitiş ayı başlangıç ayından önce seçilirse
- Tutar sıfır veya negatif girilirse
- Para birimi / kur eksikse
- Kasa / banka hesabı seçilmeden ödeme veya tahsilat yapılmak istenirse

---

## 8. Finans Merkezi Ana Ekranı

Finans Merkezi ana ekranı bir kontrol paneli olacaktır.

Amaç:

> Muhasebe elemanı ekrana girdiği anda bugün ne yapması gerektiğini anlamalıdır.

Ana ekran bölümleri:

1. Üst özet kartları
2. Bugün yapılacaklar
3. Hızlı işlemler
4. Kritik uyarılar
5. Yaklaşan dönem kapanışı
6. Son finans hareketleri

---

## 9. Üst Özet Kartları

Ana ekranda aşağıdaki özet kartları bulunacaktır:

- Bugünkü Kasa / Banka Durumu
- Bekleyen Müşteri Alacakları
- Ödenecek Sanatçı / Hizmet Borçları
- Ortak Üzerindeki Para
- Devreden Açık Kalemler
- Bu Ay Net Sonuç

Kartlar sade olacaktır.

Her kartta:

- Büyük tutar
- Kısa açıklama
- Durum rengi
- Tıklanınca detay ekranına geçiş

---

## 10. Bugün Yapılacaklar Paneli

Muhasebe elemanının en çok kullanacağı alan burasıdır.

Örnek içerik:

### Bekleyen Tahsilatlar

- Kaya Wedding: 20.000 TL müşteri alacağı var
- Corporate Gala: 15.000 TL tahsilat bekliyor

### Ödenecek Borçlar

- Frekans Band: 7.000 TL açık sanatçı borcu var
- Ses Sistemi Hizmeti: 4.500 TL ödeme bekliyor

### Ortak Üzerindeki Paralar

- Ortak 1 üzerinde 5.000 TL teslim bekliyor
- Ortak 2 üzerinde 12.000 TL teslim bekliyor

### Devreden Kalemler

- Mayıs döneminden 10.000 TL müşteri alacağı devretti
- Haziran döneminden 6.000 TL sanatçı borcu devretti

### Dönem Uyarıları

- Haziran dönemi kapanışa hazırlanabilir
- 2 etkinlik finans kapanışına hazır değil
- 1 etkinlikte açık borç var

---

## 11. Hızlı İşlemler

Ana ekranda aşağıdaki hızlı işlem butonları olacaktır:

- Tahsilat Gir
- Gider Faturası Gir
- Sezonluk Gider Gir
- Sanatçı / Hizmet Ödemesi Yap
- Ortaktan Para Teslim Al
- Devreden Kalem Kapat
- Etkinlik Finans Kapanışı Yap
- Dönem Kapanışı Yap

Bu butonlar modal / panel açacaktır.

Kullanıcı sayfalar arasında kaybolmayacaktır.

---

## 12. Gider Faturası Ekranı

Gider ekranı iki ana seçeneğe sahip olacaktır:

1. Normal Dönem Gideri
2. Sezonluk Gider

### 12.1 Normal Dönem Gideri

Kullanıcı şunları girer:

- Gider başlığı
- Gider tarihi
- Tutar
- Para birimi
- Kasa / banka hesabı
- Açıklama
- Belge numarası

Sistem gideri ilgili döneme yazar.

### 12.2 Sezonluk Gider

Kullanıcı şunları girer:

- Gider başlığı
- Gider tarihi
- Toplam tutar
- Başlangıç ayı
- Bitiş ayı
- Açıklama
- Belge numarası

Sistem otomatik olarak aylara böler.

Örnek ekran metni:

> Bu gider 7 aya bölünecek.
>
> Her aya düşen tutar: 10.000 TL

Kullanıcı onayladıktan sonra kayıt yapılır.

---

## 13. Devreden Kalemler Ekranı

Bu ekran muhasebe elemanının geçmiş dönemden gelen açık işleri takip ettiği ekrandır.

Sütunlar:

- Kaynak dönem
- Hedef dönem
- Kalem tipi
- Etkinlik
- Cari kişi / kurum
- Tutar
- Kalan
- Durum
- İşlem

Kalem tipleri:

- Müşteri Alacağı
- Sanatçı / Hizmet Borcu
- Ortağın Üzerindeki Para
- Şirketin Ortağa Borcu
- Açık Etkinlik

İşlem butonları:

- Tahsil Et
- Öde
- Teslim Al
- Kapat
- Detay Gör

Açık etkinlik doğrudan ödeme ile kapatılamaz.

Açık etkinlik için buton:

- Etkinlik Kapanışına Git

---

## 14. Dönem Kapanışı Ekranı

Dönem kapanışı ekranı muhasebe elemanına sade bir kontrol listesi sunacaktır.

Bölümler:

- Gelirler
- Etkinlik maliyetleri
- Etkinlik giderleri
- Normal dönem giderleri
- Sezonluk gider payları
- Müşteri alacakları
- Sanatçı / hizmet borçları
- Ortak üzerindeki paralar
- Devreden kalemler
- Net dönem sonucu

Sistem şu bilgiyi net göstermelidir:

> Bu dönem kapatılırsa şu kalemler sonraki döneme devredilecek.

Dönem kapanış butonu ancak sistem kontrolünden sonra aktif olmalıdır.

---

## 15. Etkinlik Finans Kapanışı Ekranı

Etkinlik kapanışı ekranı etkinlik bazında kontrol listesi sunacaktır.

Kontrol başlıkları:

- Anlaşma tutarı var mı?
- Ödeme planı var mı?
- Tahsilat tamam mı?
- Sanatçı / hizmet borcu girildi mi?
- Açık borç kaldı mı?
- Giderler girildi mi?
- Ortağın üzerinde para kaldı mı?
- Gerçek kâr hesaplandı mı?

Eksikler varsa sistem açıkça göstermelidir:

> Bu etkinlik kapanışa hazır değil.

Örnek eksikler:

- Müşteri tahsilatı tamamlanmamış
- Açık sanatçı / hizmet borcu var
- Ortağın üzerinde teslim edilmemiş para var

---

## 16. Cari Hesaplar

Finans Merkezi aşağıdaki cari ekranları içerecektir:

- Müşteri Cari
- Sanatçı / Hizmet Cari
- Ortak Cari

### 16.1 Müşteri Cari

Gösterilecek bilgiler:

- Etkinlik
- Tahakkuk eden tutar
- Tahsil edilen tutar
- Kalan alacak
- Tahsilat tarihi
- Belge no
- Açıklama

### 16.2 Sanatçı / Hizmet Cari

Gösterilecek bilgiler:

- Etkinlik
- Oluşan borç
- Yapılan ödeme
- Kalan borç
- Kümülatif bakiye
- Ödeme kaynağı
- Belge no
- Açıklama

### 16.3 Ortak Cari

Gösterilecek bilgiler:

- Ortağın aldığı tahsilatlar
- Ortağın şirkete teslim ettiği paralar
- Ortağın yaptığı ödemeler
- Şirketin ortağa borcu
- Ortağın şirkete borcu
- Kümülatif bakiye

---

## 17. Ekran Dili

Ekran dili kısa, net ve günlük muhasebe diline yakın olacaktır.

Kötü örnek:

> carry_forward_item settled successfully

İyi örnek:

> Devreden müşteri alacağı kapatıldı.

Kötü örnek:

> profit_effect none

İyi örnek:

> Bu işlem yeni dönem kârını etkilemez.

Kötü örnek:

> supplier payable movement created

İyi örnek:

> Sanatçı / hizmet borcu ödeme kaydı oluşturuldu.

---

## 18. Görsel Tasarım Prensibi

Finans Merkezi modern, ferah ve güven veren bir ekran olmalıdır.

Görsel hedef:

- Temiz dashboard
- Büyük ve okunabilir özet kartları
- Sade renkli durum rozetleri
- Az ama anlamlı ikon
- Fazla kalabalık olmayan tablolar
- Kritik işlem öncesi net onay modalları
- İşlem sonrası kısa başarı bildirimi
- Mobil uyumlu yapı
- Profesyonel SaaS hissi

---

## 19. Durum Renkleri

Önerilen durum anlamları:

- Yeşil: tamamlandı / tahsil edildi / ödendi
- Sarı: bekliyor / kısmi / takipte
- Kırmızı: gecikmiş / açık risk / kapanışa engel
- Mavi: bilgilendirme / dönemsel durum
- Gri: pasif / eski / kapalı

Renkler bağırmayacak, kurumsal ve sade kullanılacaktır.

---

## 20. İşlem Sonrası Bildirimler

Her işlemden sonra kullanıcıya kısa ve net bildirim verilecektir.

Örnekler:

- Tahsilat kaydedildi.
- Devreden müşteri alacağı kapatıldı.
- Sezonluk gider 7 aya bölündü.
- Sanatçı / hizmet ödemesi kaydedildi.
- Dönem kapatıldı ve açık kalemler devredildi.
- Bu işlem yapılamaz çünkü dönem kapalı.

---

## 21. Rol ve Yetki Prensibi

V1 aşamasında finans işlemleri yetkili kullanıcılar tarafından yapılacaktır.

İleride ayrı roller tanımlanabilir:

- Muhasebe Elemanı
- Finans Yetkilisi
- Yönetici
- Süper Admin

Kritik işlemler için ileride onay mekanizması eklenebilir:

- Dönem kapanışı
- Etkinlik finans kapanışı
- Büyük tutarlı gider
- Büyük tutarlı ortak ödeme
- Geçmiş dönem düzeltmesi

---

## 22. Frontend Uygulama Sırası

Finans Merkezi frontend geliştirme sırası:

1. Finans Merkezi ana dashboard
2. Gider faturası ve sezonluk gider ekranı
3. Devreden kalemler ekranı
4. Tahsilat / ödeme hızlı işlem ekranları
5. Dönem kapanışı ekranı
6. Etkinlik finans kapanışı ekranı
7. Cari hesaplar ve ekstre ekranları
8. Finans raporları

---

## 23. Dashboard İlk Sürümde Olması Gerekenler

Step 9.1 kapsamında ilk dashboard şu bölümleri içermelidir:

- Sayfa başlığı: Finans Merkezi
- Kısa açıklama: Günlük muhasebe işlemleri, alacaklar, borçlar ve dönem kapanışları
- Özet kartları
- Hızlı işlem kartları
- Bugün yapılacaklar paneli
- Kritik uyarılar paneli
- Son finans hareketleri alanı

İlk sürümde bazı veriler backend endpointleri tamamlanana kadar kontrollü şekilde placeholder olabilir.

Ancak tasarım dili final ürün hissine yakın olmalıdır.

---

## 24. Nihai Hedef

Finans Merkezi, VIA EVENTS projesinin vitrin modüllerinden biri olacaktır.

Hedef:

> Muhasebe elemanı sistemi rahat kullansın.
>
> Patron ekrana baktığında işin kontrol altında olduğunu hissetsin.
>
> Ürünü gören müşteri bunun basit bir etkinlik takip ekranı değil, gerçek bir işletme yönetim sistemi olduğunu anlasın.

Bu modül VIA EVENTS için ustalık işi olarak ele alınacaktır.
