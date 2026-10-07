#!/usr/bin/env bash
# Uçtan uca testleri temiz bir veritabanında çalıştırır.
#   bash run.sh            → tüm senaryolar
#   bash run.sh -k finans  → pytest argümanları aynen geçer
# Gerekenler: docker compose ile PostgreSQL açık, apps/api/.venv ve apps/e2e/.venv kurulu.
set -euo pipefail
cd "$(dirname "$0")"
E2E="$(pwd)"
API="$E2E/../api"
WEB="$E2E/../web"
PORT=8001
DB_URL="postgresql+psycopg://via:via_dev_password@localhost:5433/via_e2e"

echo "== Ön yüz derleniyor"
(cd "$WEB" && npm run build >/dev/null)

echo "== via_e2e veritabanı sıfırlanıyor"
docker exec via-postgres psql -q -U via -d via -c "DROP DATABASE IF EXISTS via_e2e WITH (FORCE)" -c "CREATE DATABASE via_e2e" >/dev/null
export VIA_DATABASE_URL="$DB_URL"
(cd "$API" && .venv/Scripts/alembic upgrade head >/dev/null 2>&1 \
  && .venv/Scripts/python -m app.cli create-admin --name "Mustafa Karadeniz" \
     --email admin@viaevents-e2e.com --password "E2e-Admin-2026!" >/dev/null)

# Windows'ta uvicorn.exe asıl Python sürecini alt süreç olarak başlatır; portu tutan süreç
# ağacıyla birlikte kapatılır. Yoksa eski kodla çalışan bir sunucu açık kalır.
stop_server() {
  for pid in $(netstat -ano | awk -v p=":$PORT" '$2 ~ p"$" && $4 == "LISTENING" {print $5}' | sort -u); do
    taskkill //F //T //PID "$pid" >/dev/null 2>&1 || true
  done
}
stop_server

echo "== Sunucu başlatılıyor (:$PORT)"
(cd "$API" && VIA_STATIC_DIR="$(cd "$WEB/dist" && pwd -W 2>/dev/null || pwd)" \
  .venv/Scripts/uvicorn app.main:app --host 127.0.0.1 --port $PORT) >"$E2E/server.log" 2>&1 </dev/null &
trap stop_server EXIT
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$PORT/api/v1/health" >/dev/null && break; sleep 0.5; done

echo "== Senaryolar"
export PYTHONIOENCODING=utf-8 MSYS_NO_PATHCONV=1
.venv/Scripts/python -m pytest "$@"
