from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.deps import Context, DbSession, require
from app.core.permissions import Permission
from app.modules.partners import service
from app.modules.partners.schemas import PartnerCreate, PartnerRead, PartnerUpdate
from app.modules.users.models import User

router = APIRouter(prefix="/partners", tags=["partners"])

Viewer = Annotated[User, Depends(require(Permission.PARTNERS_VIEW))]
Manager = Annotated[User, Depends(require(Permission.PARTNERS_MANAGE))]


@router.get("", response_model=list[PartnerRead])
def list_partners(db: DbSession, _: Viewer, include_inactive: bool = False) -> list[PartnerRead]:
    return [
        service.to_read(p) for p in service.list_partners(db, include_inactive=include_inactive)
    ]


@router.get("/{partner_id}", response_model=PartnerRead)
def get_partner(partner_id: int, db: DbSession, _: Viewer) -> PartnerRead:
    return service.to_read(service.get_partner(db, partner_id))


@router.post("", response_model=PartnerRead, status_code=status.HTTP_201_CREATED)
def create_partner(
    data: PartnerCreate, db: DbSession, actor: Manager, context: Context
) -> PartnerRead:
    return service.to_read(service.create_partner(db, data, actor=actor, context=context))


@router.patch("/{partner_id}", response_model=PartnerRead)
def update_partner(
    partner_id: int, data: PartnerUpdate, db: DbSession, actor: Manager, context: Context
) -> PartnerRead:
    partner = service.get_partner(db, partner_id)
    return service.to_read(service.update_partner(db, partner, data, actor=actor, context=context))
