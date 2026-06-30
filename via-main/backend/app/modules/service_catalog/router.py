from fastapi import APIRouter

from app.modules.service_catalog.routers.artist_router import router as artist_router
from app.modules.service_catalog.routers.package_router import router as package_router
from app.modules.service_catalog.routers.service_router import router as service_router

router = APIRouter()
router.include_router(artist_router)
router.include_router(service_router)
router.include_router(package_router)
