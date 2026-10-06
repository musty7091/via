from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core import clock
from app.core.deps import Context, CurrentUser, DbSession
from app.core.errors import PermissionDeniedError
from app.core.permissions import Permission, permissions_for
from app.modules.rates import service
from app.modules.rates.service import RateRead, RateSet
from app.modules.users.models import User

router = APIRouter(prefix="/rates", tags=["rates"])


def _can_set_rates(user: CurrentUser) -> User:
    """Kuru, dövizli kayıt girebilen herkes düzeltebilir (teklif veya finans)."""
    allowed = permissions_for(user.role) & {Permission.OFFERS_MANAGE, Permission.FINANCE_RECORD}
    if not allowed:
        raise PermissionDeniedError()
    return user


Editor = Annotated[User, Depends(_can_set_rates)]


@router.get("", response_model=list[RateRead])
def get_rates(db: DbSession, _: CurrentUser, on: date | None = None) -> list[RateRead]:
    return service.rates_for(db, on or clock.today())


@router.put("", response_model=RateRead)
def set_rate(data: RateSet, db: DbSession, actor: Editor, context: Context) -> RateRead:
    return service.set_rate(db, data, actor=actor, context=context)


@router.post("/fetch", response_model=list[RateRead])
def fetch(db: DbSession, _: Editor) -> list[RateRead]:
    return service.fetch_tcmb(db)
