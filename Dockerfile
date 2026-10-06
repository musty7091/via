# VIA EVENTS — tek imaj: derlenmiş ön yüz + API (aynı adresten sunulur).
# Derleme:  docker build -t via-events .

# --- 1) Ön yüz ---
FROM node:22-alpine AS web
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/web/ ./
RUN npm run build

# --- 2) API ---
FROM python:3.12-slim AS api
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

COPY apps/api/pyproject.toml ./
RUN mkdir app && touch app/__init__.py \
    && pip install . \
    && rm -rf app build *.egg-info
COPY apps/api/alembic.ini ./
COPY apps/api/alembic ./alembic
COPY apps/api/app ./app
COPY --from=web /web/dist ./web

RUN useradd --system --uid 10001 via && chown -R via /app
USER via

ENV VIA_ENVIRONMENT=production \
    VIA_STATIC_DIR=/app/web \
    VIA_TRUSTED_PROXIES=1 \
    PORT=8080
EXPOSE 8080

# Cloud Run PORT değişkenini verir. Tek işlemci için tek worker yeterli;
# senkron uç noktalar iş parçacığı havuzunda çalışır.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --no-server-header --timeout-graceful-shutdown 20"]
