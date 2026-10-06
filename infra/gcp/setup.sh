#!/usr/bin/env bash
# Tek seferlik kurulum. Projede ücretli kaynak açmaz: Cloud SQL yok, min-instances 0.
#
# Kullanım:
#   VIA_GCP_PROJECT=proje-id bash infra/gcp/setup.sh "postgresql+psycopg://...neon.tech/neondb?sslmode=require"
#
# Tekrar çalıştırmak güvenlidir; var olan kaynaklar atlanır.

source "$(dirname "$0")/config.sh"

DATABASE_URL="${1:-}"
if [[ -z "$DATABASE_URL" ]]; then
  echo "Neon bağlantı adresini ilk parametre olarak verin (postgresql+psycopg://... ?sslmode=require)." >&2
  exit 1
fi
if [[ "$DATABASE_URL" != postgresql+psycopg://* ]]; then
  echo "Adres 'postgresql+psycopg://' ile başlamalı (Neon'un verdiği 'postgresql://' kısmını değiştirin)." >&2
  exit 1
fi
if [[ "$DATABASE_URL" == *-pooler.* ]]; then
  echo "Neon'un 'pooled' (-pooler) adresi değil, doğrudan (direct) adresini kullanın." >&2
  exit 1
fi

echo "== API'ler açılıyor"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com storage.googleapis.com

echo "== İmaj deposu (son 2 imaj tutulur; 0,5 GB ücretsiz kota için)"
if ! gcloud artifacts repositories describe "$REPO" --location "$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPO" --repository-format docker --location "$REGION" \
    --description "VIA EVENTS imajları"
fi
policy="$(mktemp)"
cat >"$policy" <<'JSON'
[
  {"name": "son-2-imaj", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 2}},
  {"name": "eskileri-sil", "action": {"type": "Delete"}, "condition": {"tagState": "any"}}
]
JSON
gcloud artifacts repositories set-cleanup-policies "$REPO" --location "$REGION" \
  --policy "$policy" --no-dry-run
rm -f "$policy"

echo "== Servis hesapları (en az yetki)"
for sa in via-app via-backup via-scheduler; do
  gcloud iam service-accounts describe "${sa}@${PROJECT_ID}.iam.gserviceaccount.com" >/dev/null 2>&1 \
    || gcloud iam service-accounts create "$sa" --display-name "VIA ${sa#via-}"
done

echo "== Gizli değerler"
put_secret() {  # ad, değer
  if gcloud secrets describe "$1" >/dev/null 2>&1; then
    printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=-
  else
    printf '%s' "$2" | gcloud secrets create "$1" --replication-policy automatic --data-file=-
  fi
}
put_secret "$SECRET_DB" "$DATABASE_URL"
if ! gcloud secrets describe "$SECRET_KEY" >/dev/null 2>&1; then
  put_secret "$SECRET_KEY" "$(head -c 48 /dev/urandom | base64 | tr -d '\n/+=')"
fi
gcloud secrets add-iam-policy-binding "$SECRET_DB" \
  --member "serviceAccount:${APP_SA}" --role roles/secretmanager.secretAccessor >/dev/null
gcloud secrets add-iam-policy-binding "$SECRET_KEY" \
  --member "serviceAccount:${APP_SA}" --role roles/secretmanager.secretAccessor >/dev/null
gcloud secrets add-iam-policy-binding "$SECRET_DB" \
  --member "serviceAccount:${BACKUP_SA}" --role roles/secretmanager.secretAccessor >/dev/null

echo "== Yedek kovası (30 günden eski yedekler silinir)"
if ! gcloud storage buckets describe "gs://${BACKUP_BUCKET}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BACKUP_BUCKET}" --location "$REGION" \
    --uniform-bucket-level-access --public-access-prevention
fi
lifecycle="$(mktemp)"
echo '{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 30}}]}' >"$lifecycle"
gcloud storage buckets update "gs://${BACKUP_BUCKET}" --lifecycle-file "$lifecycle"
rm -f "$lifecycle"
gcloud storage buckets add-iam-policy-binding "gs://${BACKUP_BUCKET}" \
  --member "serviceAccount:${BACKUP_SA}" --role roles/storage.objectCreator >/dev/null

echo "Kurulum tamam. Sıradaki adım: bash infra/gcp/deploy.sh"
