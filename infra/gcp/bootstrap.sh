#!/usr/bin/env bash
# Sıfırdan canlı ortam: Google Cloud projesi + Neon veritabanı + kurulum + yayın + yönetici
# + gece yedeği + 1 USD bütçe uyarısı. Önkoşul: `gcloud auth login` ve `neonctl auth`
# yeni (işletme) hesabıyla yapılmış, Google Cloud ücretsiz denemesi başlatılmış olmalı.
#
# Kullanım:  bash infra/gcp/bootstrap.sh ["Ad Soyad" yonetici@eposta.com]
# Yönetici bilgisi verilmezse o adım atlanır (sonra create-admin.sh ile yapılır).
# Tekrar çalıştırmak güvenlidir.

set -euo pipefail
cd "$(dirname "$0")/../.."
ADMIN_NAME="${1:-}"
ADMIN_EMAIL="${2:-}"
NEON=(npx -y neonctl@8)
# Neon hesabında birden fazla organizasyon varsa NEON_ORG ile seçilir; yoksa ilki kullanılır.
NEON_ORG="${NEON_ORG:-$("${NEON[@]}" orgs list --output json | python -c "
import json,sys
d=json.load(sys.stdin); items=d.get('organizations',d) if isinstance(d,dict) else d
print(items[0]['id'] if items else '')")}"
ORG_ARGS=(); [[ -n "$NEON_ORG" ]] && ORG_ARGS=(--org-id "$NEON_ORG")

ACCOUNT="$(gcloud config get-value account 2>/dev/null)"
echo "Google hesabı: ${ACCOUNT}"
[[ "$ACCOUNT" == "ftm.yedekleme@gmail.com" ]] && { echo "Eski hesap etkin; önce yeni hesapla gcloud auth login." >&2; exit 1; }

# --- Proje ---
if [[ -z "${VIA_GCP_PROJECT:-}" ]]; then
  VIA_GCP_PROJECT="$(gcloud projects list --filter 'name=VIA EVENTS' --format 'value(projectId)' | head -1)"
fi
if [[ -z "$VIA_GCP_PROJECT" ]]; then
  VIA_GCP_PROJECT="via-events-$(date +%y%m)$((RANDOM % 900 + 100))"
  echo "== Proje oluşturuluyor: $VIA_GCP_PROJECT"
  gcloud projects create "$VIA_GCP_PROJECT" --name "VIA EVENTS" --quiet
fi
export VIA_GCP_PROJECT
echo "Proje: $VIA_GCP_PROJECT"

BILLING="$(gcloud billing accounts list --filter 'open=true' --format 'value(name)' | head -1)"
[[ -n "$BILLING" ]] || { echo "Açık faturalandırma hesabı yok; Google Cloud ücretsiz denemesini başlatın." >&2; exit 1; }
gcloud billing projects link "$VIA_GCP_PROJECT" --billing-account "$BILLING" --quiet >/dev/null
echo "Faturalandırma bağlı: $BILLING"

# --- Neon ---
NEON_ID="$("${NEON[@]}" projects list "${ORG_ARGS[@]}" --output json | python -c "
import json,sys
data=json.load(sys.stdin); items=data.get('projects',data) if isinstance(data,dict) else data
print(next((p['id'] for p in items if p['name']=='via-events'),''))")"
if [[ -z "$NEON_ID" ]]; then
  echo "== Neon projesi oluşturuluyor (Frankfurt, Postgres 17)"
  NEON_ID="$("${NEON[@]}" projects create "${ORG_ARGS[@]}" --name via-events --region-id aws-eu-central-1 \
    --pg-version 17 --output json | python -c "import json,sys; print(json.load(sys.stdin)['project']['id'])")"
fi
RAW="$("${NEON[@]}" connection-string --project-id "$NEON_ID" --ssl require)"
DATABASE_URL="${RAW/postgresql:\/\//postgresql+psycopg://}"
DATABASE_URL="${DATABASE_URL/postgres:\/\//postgresql+psycopg://}"
echo "Neon projesi: $NEON_ID (bağlantı adresi gizli tutuluyor)"

# --- Kurulum, yayın, yedek ---
bash infra/gcp/setup.sh "$DATABASE_URL"
bash infra/gcp/deploy.sh

source infra/gcp/config.sh
if [[ -n "$ADMIN_EMAIL" ]] && ! gcloud secrets describe via-admin-initial-password >/dev/null 2>&1; then
  INITIAL="$(head -c 24 /dev/urandom | base64 | tr -d '\n/+=' | cut -c1-20)"
  printf '%s' "$INITIAL" | gcloud secrets create via-admin-initial-password \
    --replication-policy automatic --data-file=- >/dev/null
  VIA_ADMIN_PASSWORD="$INITIAL" bash infra/gcp/create-admin.sh "$ADMIN_NAME" "$ADMIN_EMAIL"
fi
bash infra/gcp/backup-setup.sh

# --- Bütçe uyarısı (~1 USD, faturalandırma hesabının para biriminde) ---
BA="${BILLING#billingAccounts/}"
CUR="$(command gcloud billing accounts describe "$BA" --format 'value(currencyCode)')"
case "$CUR" in TRY) AMOUNT=40 ;; EUR|USD|GBP) AMOUNT=1 ;; *) AMOUNT=1 ;; esac
gcloud services enable billingbudgets.googleapis.com >/dev/null
if ! command gcloud billing budgets list --billing-account "$BA" --billing-project "$VIA_GCP_PROJECT"     --format 'value(displayName)' 2>/dev/null | grep -q '^VIA '; then
  command gcloud billing budgets create --billing-account "$BA" --billing-project "$VIA_GCP_PROJECT"     --display-name "VIA ${AMOUNT} ${CUR}" --budget-amount "${AMOUNT}${CUR}"     --filter-projects "projects/${VIA_GCP_PROJECT}"     --threshold-rule percent=0.5 --threshold-rule percent=0.9 --threshold-rule percent=1.0     --quiet >/dev/null && echo "Bütçe uyarısı kuruldu (${AMOUNT} ${CUR})."
fi

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)')"
cat <<EOF

Hazır: $URL
Yönetici: $ADMIN_EMAIL
İlk şifreyi görmek için:
  gcloud secrets versions access latest --secret via-admin-initial-password --project $VIA_GCP_PROJECT
İlk girişte şifrenizi değiştirin, sonra bu gizli değeri silin:
  gcloud secrets delete via-admin-initial-password --project $VIA_GCP_PROJECT
EOF
