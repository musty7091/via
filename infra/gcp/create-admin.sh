#!/usr/bin/env bash
# Canlı ortamda ilk süper admini oluşturur. Şifre komut satırına/loglara yazılmaz:
# geçici bir gizli değere konur, iş çalışınca silinir.
#
# Kullanım:  VIA_GCP_PROJECT=proje-id bash infra/gcp/create-admin.sh "Ad Soyad" e-posta@adres.com

source "$(dirname "$0")/config.sh"

NAME="${1:?Ad soyad verin}"
EMAIL="${2:?E-posta verin}"
# Şifre VIA_ADMIN_PASSWORD ile verilebilir (bootstrap.sh); yoksa sorulur.
PASSWORD="${VIA_ADMIN_PASSWORD:-}"
if [[ -z "$PASSWORD" ]]; then
  read -rsp "Şifre (en az 10 karakter): " PASSWORD; echo
  read -rsp "Şifre (tekrar): " AGAIN; echo
  [[ "$PASSWORD" == "$AGAIN" ]] || { echo "Şifreler eşleşmiyor." >&2; exit 1; }
fi

printf '%s' "$PASSWORD" | gcloud secrets create "$SECRET_ADMIN" --replication-policy automatic --data-file=-
trap 'gcloud secrets delete "$SECRET_ADMIN" >/dev/null 2>&1 || true' EXIT
gcloud secrets add-iam-policy-binding "$SECRET_ADMIN" \
  --member "serviceAccount:${APP_SA}" --role roles/secretmanager.secretAccessor >/dev/null

IMAGE_REF="$(gcloud run services describe "$SERVICE" --region "$REGION" \
  --format 'value(spec.template.spec.containers[0].image)')"
SECRETS="VIA_DATABASE_URL=${SECRET_DB}:latest,VIA_SECRET_KEY=${SECRET_KEY}:latest,VIA_ADMIN_PASSWORD=${SECRET_ADMIN}:latest"

gcloud run jobs delete via-create-admin --region "$REGION" >/dev/null 2>&1 || true
gcloud run jobs create via-create-admin --region "$REGION" --image "$IMAGE_REF" \
  --service-account "$APP_SA" --set-secrets "$SECRETS" --max-retries 0 \
  --command python --args "-m,app.cli,create-admin,--name,${NAME},--email,${EMAIL}"
gcloud run jobs execute via-create-admin --region "$REGION" --wait
gcloud run jobs delete via-create-admin --region "$REGION" >/dev/null
echo "Yönetici hazır: $EMAIL"
