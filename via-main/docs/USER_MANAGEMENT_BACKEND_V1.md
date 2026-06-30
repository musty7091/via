# Kullanıcı ve Yetki Yönetimi v1 - Backend API

## Amaç

Admin, sistem kullanıcılarını arayüzden yönetebilmelidir.

## Bu adımda eklenen backend endpointleri

- `GET /api/v1/users`
- `POST /api/v1/users`
- `PUT /api/v1/users/{user_id}`
- `POST /api/v1/users/{user_id}/reset-password`

## Güvenlik kuralları

- Kullanıcı yönetimi endpointlerini sadece `super_admin` kullanabilir.
- Kullanıcı fiziksel olarak silinmez.
- Kullanıcı pasif yapılabilir.
- Super admin kendi hesabını pasif yapamaz.
- Şifre veritabanında düz metin tutulmaz; hashlenir.

## Roller

- `super_admin`
- `partner_manager`
- `accounting`
- `operation`
- `viewer`

## Sonraki adım

Frontend Kullanıcılar ekranı eklenecek.
