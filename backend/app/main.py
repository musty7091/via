from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request

from app.api.api_router import api_router
from app.core.config import check_production_security, settings
from app.modules.partners.router import router as partners_router
from app.modules.showcase.router import admin_router as showcase_admin_router
from app.modules.showcase.router import public_router as showcase_public_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Açılışta bir KEZ çalışır: güvenlik kontrolü + şema/temel veri.

    Hata olursa YÜKSELTİLİR; uygulama başlamaz (fail-fast). Bu, hatalı bir
    migration veya güvensiz production yapılandırmasıyla servise çıkmayı önler.
    """
    check_production_security()
    from app.db.bootstrap import bootstrap

    bootstrap()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.3.0",
    description="VIA EVENTS backend API",
    lifespan=lifespan,
)


# CORS: aynı adresten servis edildiğinde gerek yok; yerel geliştirme ve
# (gerekirse) ayrı domain senaryoları için yapılandırılabilir.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1):[0-9]+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Denetim günlüğü: değiştirici istekleri audit_logs'a yazar (isteği bozmaz)
from app.core.audit import AuditLogMiddleware  # noqa: E402

app.add_middleware(AuditLogMiddleware)

app.include_router(api_router, prefix="/api/v1")
app.include_router(partners_router, prefix="/api/v1")
# Vitrin: public (giriş yok) + admin (super_admin) — bağımsız alan
app.include_router(showcase_public_router, prefix="/api/v1")
app.include_router(showcase_admin_router, prefix="/api/v1")


# --- Derlenmiş frontend'i (React) servis et ----------------------------------
# Docker imajında frontend "app/static" klasörüne kopyalanır.
STATIC_DIR = Path(__file__).resolve().parent / "static"
INDEX_FILE = STATIC_DIR / "index.html"
ASSETS_DIR = STATIC_DIR / "assets"

if ASSETS_DIR.is_dir():
    # Vite çıktısı /assets altındaki js/css dosyaları
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/api/v1/health/ping")
def ping():
    return {"status": "ok"}


if INDEX_FILE.is_file():
    # Kök ve diğer ön yüz yolları için React index.html döndür (SPA).
    @app.get("/")
    def serve_index():
        return FileResponse(INDEX_FILE)

    @app.get("/{full_path:path}")
    def serve_spa(request: Request, full_path: str):
        # API ve docs yolları buraya düşmez (yukarıda tanımlı). Statik bir dosya
        # isteniyorsa onu döndür; aksi halde SPA için index.html.
        candidate = (STATIC_DIR / full_path).resolve()
        if (
            candidate.is_file()
            and STATIC_DIR in candidate.parents
        ):
            return FileResponse(candidate)
        return FileResponse(INDEX_FILE)

else:
    # Frontend derlenmemişse (ör. yalnızca API olarak çalıştırıldığında)
    @app.get("/")
    def root():
        return JSONResponse(
            {
                "message": "VIA EVENTS API",
                "docs": "/docs",
                "health": "/api/v1/health",
            }
        )
