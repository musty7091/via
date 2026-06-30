# Kullanıcı ve Yetki Yönetimi Frontend v1

## Amaç

`super_admin` kullanıcının sistem kullanıcılarını arayüzden yönetebilmesini sağlar.

## Eklenen ekran

Dashboard > Kullanıcılar

## Özellikler

- Kullanıcı listeleme
- Kullanıcı arama
- Aktif / pasif filtreleme
- Yeni kullanıcı oluşturma
- Rol seçimi
- Kullanıcı aktif / pasif yapma
- Kullanıcı temel bilgilerini güncelleme
- Şifre sıfırlama

## Rol seçenekleri

- super_admin
- partner_manager
- accounting
- operation
- viewer

## Güvenlik

Kullanıcılar ekranı Dashboard'da yalnızca `super_admin` rolüne görünür. Backend tarafında da aynı yetki kontrolü vardır.
