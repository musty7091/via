from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.modules.customers.router import router as customers_router
from app.modules.events.router import router as events_router
from app.modules.offers.router import router as offers_router
from app.modules.service_catalog.router import router as service_catalog_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(customers_router)
api_router.include_router(service_catalog_router)
api_router.include_router(offers_router)
api_router.include_router(events_router)
