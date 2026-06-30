from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_super_admin, get_current_user
from app.db.database import get_db
from app.models.partner import Partner
from app.models.user import User
from app.modules.partners.schemas import PartnerCreate, PartnerRead, PartnerUpdate

router = APIRouter(prefix="/partners", tags=["Partners"])


@router.get("", response_model=list[PartnerRead])
def list_partners(
    is_active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    query = db.query(Partner)

    if is_active is not None:
        query = query.filter(Partner.is_active == is_active)

    return query.order_by(Partner.id.asc()).all()


@router.post("", response_model=PartnerRead, status_code=status.HTTP_201_CREATED)
def create_partner(
    payload: PartnerCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_super_admin),
):
    partner = Partner(
        full_name=payload.full_name.strip(),
        ownership_percent=payload.ownership_percent,
        is_active=payload.is_active,
        notes=payload.notes,
    )

    db.add(partner)
    db.commit()
    db.refresh(partner)
    return partner


@router.put("/{partner_id}", response_model=PartnerRead)
def update_partner(
    partner_id: int,
    payload: PartnerUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_super_admin),
):
    partner = db.get(Partner, partner_id)

    if partner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ortak kaydı bulunamadı.",
        )

    data = payload.model_dump(exclude_unset=True)

    if "full_name" in data and data["full_name"] is not None:
        partner.full_name = data["full_name"].strip()

    if "ownership_percent" in data and data["ownership_percent"] is not None:
        partner.ownership_percent = data["ownership_percent"]

    if "is_active" in data and data["is_active"] is not None:
        partner.is_active = data["is_active"]

    if "notes" in data:
        partner.notes = data["notes"]

    db.commit()
    db.refresh(partner)
    return partner
