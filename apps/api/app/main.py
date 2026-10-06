from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.deps import csrf_protect
from app.core.errors import register_error_handlers
from app.core.web import SecurityHeaders, mount_frontend
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.catalog.router import router as catalog_router
from app.modules.closing.router import router as closing_router
from app.modules.customers.router import router as customers_router
from app.modules.events.router import router as events_router
from app.modules.finance.router import router as finance_router
from app.modules.health.router import router as health_router
from app.modules.offers.router import router as offers_router
from app.modules.operations.router import router as operations_router
from app.modules.partners.router import router as partners_router
from app.modules.rates.router import router as rates_router
from app.modules.reports.router import router as reports_router
from app.modules.settings.router import router as settings_router
from app.modules.users.router import router as users_router


def create_app() -> FastAPI:
    settings = get_settings()
    # Canlı ortamda API dokümantasyonu kapalıdır.
    docs = (
        {}
        if not settings.is_production
        else {"docs_url": None, "redoc_url": None, "openapi_url": None}
    )
    app = FastAPI(title=settings.app_name, version="2.0.0", **docs)

    app.add_middleware(SecurityHeaders, production=settings.is_production)
    if settings.cors_origins and not settings.is_production:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    register_error_handlers(app)

    api = APIRouter(prefix="/api/v1", dependencies=[Depends(csrf_protect)])
    api.include_router(health_router)
    api.include_router(auth_router)
    api.include_router(users_router)
    api.include_router(partners_router)
    api.include_router(audit_router)
    api.include_router(customers_router)
    api.include_router(catalog_router)
    api.include_router(offers_router)
    api.include_router(events_router)
    api.include_router(settings_router)
    api.include_router(finance_router)
    api.include_router(closing_router)
    api.include_router(operations_router)
    api.include_router(reports_router)
    api.include_router(rates_router)
    app.include_router(api)
    if settings.static_dir:
        mount_frontend(app, settings.static_dir)
    return app


app = create_app()
