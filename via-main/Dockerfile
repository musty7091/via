# VIA EVENTS — tek imajda frontend (React) + backend (FastAPI)
# 1. aşama Node ile arayüzü derler, 2. aşama Python backend'i kurar ve
# derlenmiş arayüzü FastAPI'nin servis edeceği app/static klasörüne koyar.

# ---------- 1. AŞAMA: Frontend derleme ----------
FROM node:20-alpine AS frontend
WORKDIR /frontend

# Önce bağımlılık dosyaları (katman önbelleği için)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Kaynak kodu kopyala ve üret
COPY frontend/ ./
RUN npm run build


# ---------- 2. AŞAMA: Backend çalışma ortamı ----------
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Python bağımlılıkları
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Backend kaynak kodu
COPY backend/ ./

# Derlenmiş frontend'i FastAPI'nin servis edeceği yere kopyala
COPY --from=frontend /frontend/dist ./app/static

EXPOSE 8000

# Açılışta veritabanını (silmeden) hazırla, sonra sunucuyu başlat.
CMD ["sh", "-c", "python -m app.db.bootstrap && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
