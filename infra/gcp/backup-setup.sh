#!/usr/bin/env bash
# Gece yedeğini kurar: her gece 03:00'te (İstanbul saati) veritabanı yedeği Cloud Storage'a.
# Cloud Scheduler'da hesap başına 3 iş ücretsizdir; burada 1 tane kullanılır.
#
# Kullanım:  VIA_GCP_PROJECT=proje-id bash infra/gcp/backup-setup.sh

source "$(dirname "$0")/config.sh"
cd "$(dirname "$0")"

# Resmi Docker Hub imajı: depomuzda yer kaplamaz.
ARGS=(--region "$REGION" --image docker.io/library/postgres:17-alpine
  --service-account "$BACKUP_SA" --set-secrets "DATABASE_URL=${SECRET_DB}:latest"
  --set-env-vars "BACKUP_BUCKET=${BACKUP_BUCKET}" --cpu 1 --memory 512Mi
  --command sh --args "-c,echo $(base64 -w0 backup-job.sh) | base64 -d | sh")
# Not: gcloud --args değerlerini virgülle böler; betik base64 olarak taşınır.

if gcloud run jobs describe via-backup --region "$REGION" >/dev/null 2>&1; then
  gcloud run jobs update via-backup "${ARGS[@]}"
else
  gcloud run jobs create via-backup "${ARGS[@]}" --max-retries 1 --task-timeout 600
fi

gcloud run jobs add-iam-policy-binding via-backup --region "$REGION" \
  --member "serviceAccount:${SCHEDULER_SA}" --role roles/run.invoker >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format 'value(projectNumber)')"
RUN_URL="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/via-backup:run"
if gcloud scheduler jobs describe via-nightly-backup --location "$REGION" >/dev/null 2>&1; then
  ACTION=update
else
  ACTION=create
fi
gcloud scheduler jobs "$ACTION" http via-nightly-backup --location "$REGION" \
  --schedule "0 3 * * *" --time-zone "$TIME_ZONE" --http-method POST --uri "$RUN_URL" \
  --oauth-service-account-email "$SCHEDULER_SA"

echo "== Deneme yedeği alınıyor"
gcloud run jobs execute via-backup --region "$REGION" --wait
gcloud storage ls "gs://${BACKUP_BUCKET}/" | tail -3
echo "(proje no: ${PROJECT_NUMBER})"
