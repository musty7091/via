# Changelog

Bu dosyada proje değişiklikleri takip edilecektir.

## 0.0.4

- Render (ücretsiz) için canlı dağıtım hazırlığı:
  - Çok aşamalı Dockerfile (frontend derlenir + backend tek imajda).
  - FastAPI artık derlenmiş React arayüzünü servis ediyor (StaticFiles + SPA yönlendirme).
  - Frontend API adresi göreli /api/v1 oldu; Vite dev proxy eklendi (yerelde 8000'e yönlenir).
  - PostgreSQL desteği (psycopg2-binary, postgres:// scheme düzeltmesi, pool_pre_ping).
  - Açılışta tabloları silmeden kuran bootstrap (app/db/bootstrap.py).
  - render.yaml blueprint (web servisi + ücretsiz Postgres) ve DEPLOY.md kılavuzu.

## 0.0.3

- Güvenli veritabanı sıfırlama scripti eklendi (app/db/reset_db.py): tüm işlem verisini
  siler, sadece temel verileri (admin, ortaklar, kasa/banka, ayarlar) yeniden kurar.
  Onay sorar ("SIFIRLA"), --force ile sorgusuz çalışır, hedef veritabanını gösterir.
- Dönem Kapanış Raporu "Etkinlikler" sekmesi yatay kaydırmayı kaldıran kart düzenine geçti.

## 0.0.2

- Tek ortak ekran tabanı (AppLayout) oluşturuldu; tüm sayfalar tek header/footer/konteynerden besleniyor.
- Rider ve Saha Kontrol modülü eklendi (backend operations API + frontend ekranı).
- Uygulama genelinde tutarlı sayfalama (Pagination + usePagination); Etkinlikler ve Giderler dahil.
- Dönem Kapanış Raporu sekmeli hale getirildi (Özet / Etkinlikler / Ortaklar / Devir / Kapanış); PDF çıktısı tam kalır.
- UÇTAN UCA DECIMAL DİSİPLİNİ: tüm parasal hesaplamalar Decimal + ROUND_HALF_UP'a taşındı.
  - Ortak app/utils/money.py yardımcı modülü (D, money, money2, rate, percent_of, convert).
  - 13 finans/muhasebe servisi float aritmetikten Decimal'e çevrildi (finance_engine, period_closing,
    offers, supplier_accounts/payables, partner_accounts, event_payments, finance_center,
    customers ledger, event_financial_closure, carry_forward_settlement, expenses, package).
  - Banka yuvarlaması (ROUND_HALF_EVEN) yerine muhasebe standardı ROUND_HALF_UP.
  - API çıktısı JSON sayı (float) olarak kalır; frontend etkilenmez.

## 0.0.1

- İlk proje klasör yapısı oluşturuldu.
- README hazırlandı.
- Proje dokümanları eklendi.
