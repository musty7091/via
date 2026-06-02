# Teklif Paket Fiyatı Kuralı

Bu kural VIA EVENTS teklif mantığının temelidir.

## Kombine paketlerde müşteri satış fiyatı

Bir program paketi teklif içine aktarıldığında müşteriye kesilecek ana satış fiyatı, paketin kendi satış fiyatıdır.

Örnek:

```text
Yaza Merhaba Paketi: 300.000 TRY
```

Bu durumda teklif toplamı paket içindeki sanatçı / teknik hizmet kalemlerinin toplamından değil, paketin kendi satış fiyatından hesaplanır.

## Program kalemleri

Paket içindeki kalemler müşteriye program akışı ve hizmet içeriği olarak görünür.

Örnek:

```text
Bang Olufsen Ses Sistemi
Asena
Sidar Karakuş
Frekans
```

Bu kalemlerin müşteri çıktısında tekrar fiyat oluşturması doğru değildir. Çünkü müşteri zaten paket bedeli üzerinden fiyat alır.

## İç maliyet ve kârlılık

Kalemlerin maliyetleri Back Office iç ekranında görünür ve kârlılık hesabına girer. Maliyetler, müşteri print / PDF çıktısına asla gitmez.

## Ön ödeme

Ön ödeme, teklifin ana para birimiyle birlikte gösterilir. Kalan tutar sistem tarafından teklif genel toplamından ön ödeme düşülerek hesaplanır.
