#!/bin/sh
# Gece yedeği: Cloud Run Job içinde postgres:17-alpine imajında çalışır.
# pg_dump çıktısını sıkıştırıp Cloud Storage'a yükler (servis hesabı jetonuyla).
# Ortam: DATABASE_URL (gizli değer), BACKUP_BUCKET. Yerel deneme için BACKUP_DRY_RUN=1.
set -eu

url="$(printf '%s' "$DATABASE_URL" | sed 's#^postgresql+psycopg://#postgresql://#')"
name="via-$(date -u +%Y%m%d-%H%M%S).sql.gz"
file="/tmp/$name"

pg_dump --no-owner --no-privileges --format=plain "$url" | gzip -9 >"$file"
size="$(wc -c <"$file")"
if [ "$size" -lt 1000 ]; then
  echo "Yedek beklenenden küçük ($size bayt); yükleme iptal." >&2
  exit 1
fi

if [ "${BACKUP_DRY_RUN:-0}" = "1" ]; then
  echo "Deneme: $name ($size bayt) oluşturuldu, yüklenmedi."
  exit 0
fi

# busybox wget --post-file ikili dosyayı ilk sıfır baytta keser; yükleme curl ile yapılır.
apk add --no-cache --quiet curl

token="$(curl -fsS -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token \
  | sed -E 's/.*"access_token":"([^"]+)".*/\1/')"
response="$(curl -fsS -X POST \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/gzip' \
  --data-binary "@$file" \
  "https://storage.googleapis.com/upload/storage/v1/b/${BACKUP_BUCKET}/o?uploadType=media&name=${name}")"

# Yüklenen boyut yereldekiyle aynı değilse yedek bozuktur; iş başarısız sayılır.
uploaded="$(printf '%s' "$response" | sed -nE 's/.*"size": *"([0-9]+)".*/\1/p' | head -n1)"
if [ "$uploaded" != "$size" ]; then
  echo "Yüklenen boyut ($uploaded) yerel dosyayla ($size) uyuşmuyor." >&2
  exit 1
fi
echo "Yedek yüklendi: gs://${BACKUP_BUCKET}/${name} ($size bayt)"
