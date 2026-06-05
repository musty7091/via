from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.modules.customers.router import router as customers_router
from app.modules.events.router import router as events_router
from app.modules.offers.router import router as offers_router
from app.modules.service_catalog.router import router as service_catalog_router
from app.modules.user_management.router import router as user_management_router

from app.modules.event_payments.router import router as event_payments_router
from app.modules.finance_center.router import router as finance_center_router
from app.modules.supplier_payables.router import router as supplier_payables_router
from app.modules.supplier_accounts.router import router as supplier_accounts_router
from app.modules.partner_accounts.router import router as partner_accounts_router
from app.modules.event_financial_closure.router import router as event_financial_closure_router
from app.modules.period_closing.router import router as period_closing_router
from app.modules.carry_forward_settlement.router import router as carry_forward_settlement_router
from app.modules.expenses.router import router as expenses_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(user_management_router)
api_router.include_router(customers_router)
api_router.include_router(service_catalog_router)
api_router.include_router(offers_router)
api_router.include_router(event_payments_router)
api_router.include_router(finance_center_router)
api_router.include_router(supplier_payables_router)
api_router.include_router(supplier_accounts_router)
api_router.include_router(partner_accounts_router)
api_router.include_router(event_financial_closure_router)
api_router.include_router(period_closing_router)
api_router.include_router(carry_forward_settlement_router)
api_router.include_router(expenses_router)
api_router.include_router(events_router)
