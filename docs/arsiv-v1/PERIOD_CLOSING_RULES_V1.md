# VIA EVENTS - Donem Kapanisi ve Devir Kurallari V1

Bu dokuman VIA EVENTS finans modulunde donem kapanisi mantiginin temel kural setidir.

## Ana Kural

Donem kapanisi acik kalemleri sifirlamaz.

Donem kapanisi:
- kapanan donemi kilitler,
- kapanan donemin raporunu sabitler,
- acik kalemleri sonraki doneme devir kaydi olarak tasir.

## Etkinlik Kapanisi ile Donem Kapanisi Farklidir

Etkinlik finans kapanisi:
- ilgili etkinlik icin tahsilat, borc, gider, ortak para ve kar dagitimi kontroludur.
- etkinlik hazir degilse etkinlik kar dagitimina kapatilir.

Donem kapanisi:
- ilgili ayin finansal raporunu kilitler.
- acik etkinlikleri ve acik cari kalemleri sonraki aya devreder.
- acik etkinlikler donem kapanisina normal sartlarda engel degildir.

## Gecmis Doneme Ait Tahsilat

Ornek:
- Mayis donemi kapandi.
- Mayis etkinliginden 10.000 TL musteri alacagi Haziran ayina devretti.
- Haziran ayinda tahsilat yapildi.

Sonuc:
- Mayis donemi tekrar acilmaz.
- Tahsilat Haziran kasa hareketidir.
- Kaynak etkinlik Mayis etkinligi olarak kalir.
- Mayis raporu geriye donuk degismez.
- Haziran kari artmaz.
- Devreden musteri alacagi kapanir.

## Gecmis Doneme Ait Sanatci/Hizmet Odeme

Ornek:
- Mayis doneminden sanatciya 5.000 TL borc devretti.
- Haziran ayinda odeme yapildi.

Sonuc:
- Haziran kasa cikisi olur.
- Mayis kaynakli devreden borc kapanir.
- Haziran gideri artmaz.
- Mayis donemi tekrar acilmaz.

## Ortak Uzerindeki Para

Ortak bir onceki donemde musteri tahsilati aldiysa ve parayi sirkete teslim etmediyse:
- kaynak donemde ortak uzerinde para devreder,
- sonraki donemde teslim alindiginda sirket kasasi artar,
- bu hareket yeni donem kasa hareketidir ama eski donemin acik ortak kalemini kapatir.

## Donem Kapanisinda Devredecek Kalem Tipleri

V1 kapsaminda devredilecek ana kalemler:
- open_event
- customer_receivable
- supplier_payable
- partner_cash_on_hand
- company_payable_to_partner

## Donem Kapanisina Engel Olmayan Durumlar

Asagidakiler donem kapanisina engel degildir, devir kalemi olarak tasinir:
- musteri alacagi acik
- sanatci/hizmet borcu acik
- ortak uzerinde para var
- sirketin ortaga borcu var
- etkinlik finans kapanisi henuz onaylanmamis

## Donem Kapanisina Engel Olabilecek Durumlar

V1 icin kesin engel:
- donemin zaten kapali/kilitli olmasi
- gecersiz donem formati

Ileriki surumlerde veri butunlugu kontrolleri eklenebilir:
- etkinlikte musteri baglantisi yok
- tahsilat event/customer baglantisi hatali
- finans hareketinde partner/event baglantisi eksik
- tutarsiz negatif bakiye
- kaynagi belirsiz kasa hareketi

## Raporlama Kurali

Kapanan donem raporu geriye donuk degistirilmez.

Sonraki donemde gelen tahsilat/odeme:
- yeni donemin nakit hareketidir,
- eski donemin devreden kalemini kapatir,
- yeni donemin karini arttirmaz veya giderini arttirmaz.
