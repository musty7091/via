# Teklif İptal Etme v1

## Ana kural

Teklifler fiziksel olarak silinmez. Kayıt geçmişi korunur ve teklif durumu `cancelled` yapılır.

## Neden gerçek silme yok?

- Teklif numarası oluşmuş olabilir.
- Müşteriye PDF / print gönderilmiş olabilir.
- İleride rapor, teklif başarı oranı ve geçmiş takip için kayıt gerekebilir.
- Muhasebe ve operasyon sistemlerinde iz bırakmak daha güvenlidir.

## Taslak teklifler

Taslak, gönderildi veya kabul edildi durumundaki teklifler iptal edilebilir.

İptal edilen teklifler varsayılan listede görünmez. Tekrar bakmak için durum filtresinden `İptal` seçilir.

## Anlaşmaya çevrilmiş teklifler

Anlaşmaya çevrilmiş teklif bu v1 akışında iptal edilmez. Çünkü bu noktadan sonra etkinlik dosyası, ödeme, gider ve kârlılık takibi oluşmuş olabilir.

Bunun için ileride ayrı bir `Anlaşma / Etkinlik İptal Süreci` kurulacaktır.
