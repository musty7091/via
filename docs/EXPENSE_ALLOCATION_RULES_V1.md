# VIA EVENTS - Gider Faturasi ve Sezonluk Gider Dagitimi V1

Bu dokuman gider faturasi ve sezonluk gider dagitimi kurallarini tarif eder.

## Gider Tipleri

V1 kapsaminda iki temel gider girisi vardir:

1. Donem gideri
   - Gider hangi ayda girildiyse o ayin gideridir.
   - Diger aylara dagitilmaz.
   - Donem kapanisinda `total_general_expense_base_amount` alanina dahil edilir.

2. Sezonluk gider
   - Gider girildigi aydan yil sonuna kadar dagitilir.
   - Her ay icin `expense_allocations` kaydi olusur.
   - Donem kapanisinda ilgili aya dusen pay `total_allocated_expense_base_amount` alanina dahil edilir.

## Sezonluk Dagitim Kuralı

Dagitim baslangici gider tarihinin ayidir.

Dagitim bitisi varsayilan olarak ayni yilin Aralik ayidir.

Ornekler:
- Ocakta girilen 120.000 TL sezon gideri 12 aya bolunur.
- Haziranda girilen 70.000 TL sezon gideri Haziran-Aralik arasi 7 aya bolunur.

## Donem Acilisinda Gecmisten Gelen Sezonluk Gider

Bir donem raporlanirken sadece o ay girilen giderler degil, onceki aylarda girilmis sezonluk giderlerin bu aya dusen paylari da dikkate alinir.

Ornek:
- Ocakta 120.000 TL sezon gideri girildi.
- Haziran donemi acildiginda/raporlandiginda Haziran icin 10.000 TL sezonluk gider payi gorunmelidir.

## Kar Etkisi

Sezonluk gider faturasinin tam tutari sadece girildigi ayin karini bozmaz.
Her ay, sadece kendisine dusen pay kadar gider etkisi alir.

## Donem Kapanisina Etki

Donem kapanisinda net kar hesabi:

Gelir
- Etkinlik maliyetleri
- Etkinlik giderleri
- Donem genel giderleri
- O aya dusen sezonluk gider paylari
= Net kar
