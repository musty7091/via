#!/usr/bin/env bash
# Yayın: imajı yerelde derler (Cloud Build kullanılmaz), yükler, veritabanı geçişlerini
# çalıştırır ve servisi günceller. Her yayında tekrar çalıştırılır.
#
# Kullanım:  VIA_GCP_PROJECT=proje-id bash infra/gcp/deploy.sh

source "$(dirname "$0")/config.sh"
cd "$(dirname "$0")/../.."

if [[ -n "$(git status --porcelain -- apps Dockerfile)" ]]; then
  echo "apps/ altında commit edilmemiş değişiklik var; önce commit edin." >&2
  exit 1
fi
TAG="$(git rev-parse --short HEAD)"

echo "== İmaj derleniyor: ${IMAGE}:${TAG}"
command gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet >/dev/null
docker build -t "${IMAGE}:${TAG}" .
docker push "${IMAGE}:${TAG}"

SECRETS="VIA_DATABASE_URL=${SECRET_DB}:latest,VIA_SECRET_KEY=${SECRET_KEY}:latest"
COMMON=(--region "$REGION" --image "${IMAGE}:${TAG}" --service-account "$APP_SA"
  --set-secrets "$SECRETS" --cpu 1 --memory 512Mi)

echo "== Veritabanı geçişleri"
if gcloud run jobs describe via-migrate --region "$REGION" >/dev/null 2>&1; then
  gcloud run jobs update via-migrate "${COMMON[@]}" --command alembic --args upgrade,head
else
  gcloud run jobs create via-migrate "${COMMON[@]}" --command alembic --args upgrade,head \
    --max-retries 0 --task-timeout 300
fi
gcloud run jobs execute via-migrate --region "$REGION" --wait

echo "== Servis güncelleniyor"
# min-instances 0: kullanılmadığında sıfıra iner (ücretsiz kota). max 2: ani yükte bile sınırlı.
gcloud run deploy "$SERVICE" "${COMMON[@]}" \
  --min-instances 0 --max-instances 2 --concurrency 40 --timeout 60 \
  --cpu-throttling --execution-environment gen2 \
  --set-env-vars VIA_DB_POOL_SIZE=3,VIA_DB_MAX_OVERFLOW=2 \
  --allow-unauthenticated --port 8080

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)')"
echo "Yayında: $URL"
curl -fsS "$URL/api/v1/health" && echo
