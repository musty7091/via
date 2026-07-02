from fastapi import APIRouter, Depends

from app.api.deps import (
    require_finance_access,
    require_operations_access,
    require_user_admin,
)
from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.modules.carry_forward_settlement.router import router as carry_forward_settlement_router
from app.modules.customers.router import router as customers_router
from app.modules.event_financial_closure.router import router as event_financial_closure_router
from app.modules.event_payments.router import router as event_payments_router
from app.modules.events.router import router as events_router
from app.modules.expenses.router import router as expenses_router
from app.modules.finance_center.router import router as finance_center_router
from app.modules.offers.router import router as offers_router
from app.modules.operations.router import router as operations_router
from app.modules.partner_accounts.router import router as partner_accounts_router
from app.modules.period_closing.router import router as period_closing_router
from app.modules.service_catalog.router import router as service_catalog_router
from app.modules.supplier_accounts.router import router as supplier_accounts_router
from app.modules.supplier_payables.router import router as supplier_payables_router
from app.modules.user_management.router import router as user_management_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)

# Kullanıcı yönetimi: yalnızca super_admin
api_router.include_router(
    user_management_router, dependencies=[Depends(require_user_admin)]
)

# Operasyon alanı: super_admin/partner_manager/operation yazar,
# accounting/viewer yalnızca görür (salt okuma).
ops_dep = [Depends(require_operations_access)]
api_router.include_router(customers_router, dependencies=ops_dep)
api_router.include_router(service_catalog_router, dependencies=ops_dep)
api_router.include_router(offers_router, dependencies=ops_dep)
api_router.include_router(operations_router, dependencies=ops_dep)
api_router.include_router(events_router, dependencies=ops_dep)

# Finans alanı: super_admin, partner_manager, accounting
finance_dep = [Depends(require_finance_access)]
api_router.include_router(event_payments_router, dependencies=finance_dep)
api_router.include_router(finance_center_router, dependencies=finance_dep)
api_router.include_router(supplier_payables_router, dependencies=finance_dep)
api_router.include_router(supplier_accounts_router, dependencies=finance_dep)
api_router.include_router(partner_accounts_router, dependencies=finance_dep)
api_router.include_router(event_financial_closure_router, dependencies=finance_dep)
api_router.include_router(period_closing_router, dependencies=finance_dep)
api_router.include_router(carry_forward_settlement_router, dependencies=finance_dep)
api_router.include_router(expenses_router, dependencies=finance_dep)
