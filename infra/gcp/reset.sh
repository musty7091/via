#!/usr/bin/env bash
# Canlıda deneme verisini siler (ör. müşteri denedikten sonra temiz başlangıç).
#
# Sırasıyla: neyin korunacağını sorar → proje kimliğinin elle yazılmasını ister → yedek alır ve
# yedeğin dolu olduğunu doğrular (değilse durur) → silme işini canlıdaki uygulama sürümüyle
# tek seferlik bir Cloud Run işi olarak çalıştırır.
#
# Her zaman silinir: teklif, etkinlik, tahsilat, gider, ödeme, ortak hareketleri, kapanışlar,
#   işlem geçmişi; belge numaraları baştan başlar.
# Her zaman kalır: süper admin hesapları, firma ayarları, kur geçmişi.
# Geri dönüş: docs/YAYIN.md → "Yedekten geri dönme" (yedekler 30 gün saklanır).
#
# Kullanım:  VIA_GCP_PROJECT=proje-id bash infra/gcp/reset.sh

source "$(dirname "$0")/config.sh"

ask_keep() {
  local answer
  read -rp "  $1 korunsun mu? [E/h]: " answer
  [[ ! "$answer" =~ ^[hH] ]]
}

echo "Deneme verisi silinecek. Korunacakları seçin (Enter = korunsun):"
FLAGS=""
KEPT=("süper admin" "firma ayarları")
DROPPED=("teklif/etkinlik/finans hareketleri" "işlem geçmişi")
for spec in \
  "catalog-|Katalog (sanatçı, hizmet, tedarikçi, paket)" \
  "customers-|Müşteriler ve mekânlar" \
  "cash-accounts-|Kasa/banka hesap tanımları (bakiyeler sıfırlanır)" \
  "people-|Ortaklar ve diğer kullanıcılar"; do
  flag="${spec%%-|*}"
  label="${spec#*|}"
  if ask_keep "$label"; then
    FLAGS+=",--keep-${flag}"
    KEPT+=("$label")
  else
    DROPPED+=("$label")
  fi
done

echo
echo "Korunacak : $(IFS=';'; echo "${KEPT[*]}" | sed 's/;/, /g')"
echo "Silinecek : $(IFS=';'; echo "${DROPPED[*]}" | sed 's/;/, /g')"
echo
read -rp "Onaylamak için proje kimliğini yazın (${PROJECT_ID}): " typed
if [[ "$typed" != "$PROJECT_ID" ]]; then
  echo "Onaylanmadı; hiçbir şey silinmedi." >&2
  exit 1
fi

echo "== Yedek alınıyor"
gcloud run jobs execute via-backup --region "$REGION" --wait >/dev/null
read -r SIZE NAME < <(
  gcloud storage ls -l "gs://${BACKUP_BUCKET}/" | awk '$3 ~ /^gs:/ {print $2, $1, $3}' | sort | tail -1 \
    | awk '{print $2, $3}'
)
if [[ -z "${SIZE:-}" || "$SIZE" -lt 1000 ]]; then
  echo "Yedek doğrulanamadı (${NAME:-yok}, ${SIZE:-0} bayt); hiçbir şey silinmedi." >&2
  exit 1
fi
echo "Yedek tamam: ${NAME} (${SIZE} bayt)"

echo "== Veriler siliniyor"
IMAGE_REF="$(gcloud run services describe "$SERVICE" --region "$REGION" \
  --format 'value(spec.template.spec.containers[0].image)')"
SECRETS="VIA_DATABASE_URL=${SECRET_DB}:latest,VIA_SECRET_KEY=${SECRET_KEY}:latest"
gcloud run jobs delete via-reset --region "$REGION" >/dev/null 2>&1 || true
gcloud run jobs create via-reset --region "$REGION" --image "$IMAGE_REF" \
  --service-account "$APP_SA" --set-secrets "$SECRETS" --max-retries 0 --task-timeout 600 \
  --command python --args "-m,app.cli,reset-data,--confirm,SIFIRLA${FLAGS}" >/dev/null
trap 'gcloud run jobs delete via-reset --region "$REGION" >/dev/null 2>&1 || true' EXIT
gcloud run jobs execute via-reset --region "$REGION" --wait

echo
echo "Tamam. Silmeden hemen önceki yedek: ${NAME}"
echo "Geri dönmek gerekirse: docs/YAYIN.md → \"Yedekten geri dönme\"."
