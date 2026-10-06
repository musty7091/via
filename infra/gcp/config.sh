# VIA EVENTS — Google Cloud ayarları. Diğer betikler bu dosyayı okur.
# PROJECT_ID'yi kendi projenizle değiştirin (veya ortam değişkeni olarak verin).

PROJECT_ID="${VIA_GCP_PROJECT:-via-events-prod}"
REGION="europe-west1"              # Belçika; Cloud Run ücretsiz kotası geçerli (Tier 1)
SERVICE="via"                      # Cloud Run servisi
REPO="via"                         # Artifact Registry deposu
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/via"
BACKUP_BUCKET="${PROJECT_ID}-via-backups"
TIME_ZONE="Europe/Istanbul"

APP_SA="via-app@${PROJECT_ID}.iam.gserviceaccount.com"
BACKUP_SA="via-backup@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_SA="via-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

# Secret Manager'daki gizli değerler (ilk 6 sürüm ücretsiz)
SECRET_DB="via-database-url"
SECRET_KEY="via-secret-key"
SECRET_ADMIN="via-admin-password"

set -euo pipefail
gcloud() { command gcloud --project "$PROJECT_ID" --quiet "$@"; }
