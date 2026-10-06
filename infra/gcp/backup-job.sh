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

token="$(wget -qO- --header 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token \
  | sed -E 's/.*"access_token":"([^"]+)".*/\1/')"
wget -qO /dev/null \
  --header "Authorization: Bearer $token" \
  --header 'Content-Type: application/gzip' \
  --post-file "$file" \
  "https://storage.googleapis.com/upload/storage/v1/b/${BACKUP_BUCKET}/o?uploadType=media&name=${name}"
echo "Yedek yüklendi: gs://${BACKUP_BUCKET}/${name} ($size bayt)"
