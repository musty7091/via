from fastapi import APIRouter

from app.modules.customers.routers.contact_router import router as contact_router
from app.modules.customers.routers.customer_router import router as customer_router
from app.modules.customers.routers.ledger_router import router as ledger_router
from app.modules.customers.routers.venue_router import router as venue_router

router = APIRouter()
router.include_router(customer_router)
router.include_router(contact_router)
router.include_router(venue_router)
router.include_router(ledger_router)