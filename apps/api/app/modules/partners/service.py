from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import RequestContext
from app.core.errors import ConflictError, DomainError, NotFoundError
from app.modules.audit import service as audit
from app.modules.partners.models import Partner
from app.modules.partners.schemas import PartnerCreate, PartnerRead, PartnerUpdate
from app.modules.users.models import User

AUDIT_FIELDS = ["full_name", "phone", "email", "is_active", "sort_order", "notes", "user_id"]


def to_read(partner: Partner) -> PartnerRead:
    return PartnerRead(
        id=partner.id,
        full_name=partner.full_name,
        phone=partner.phone,
        email=partner.email,
        is_active=partner.is_active,
        sort_order=partner.sort_order,
        notes=partner.notes,
        user_id=partner.user_id,
        user_name=partner.user.full_name if partner.user else None,
        user_email=partner.user.email if partner.user else None,
    )


def list_partners(db: Session, *, include_inactive: bool) -> list[Partner]:
    query = select(Partner)
    if not include_inactive:
        query = query.where(Partner.is_active.is_(True))
    return list(db.scalars(query.order_by(Partner.sort_order, Partner.id)).unique().all())


def active_partners(db: Session) -> list[Partner]:
    """Kâr/zarar bölüşümüne katılan ortaklar; kuruş dağıtım sırasına göre."""
    return list_partners(db, include_inactive=False)


def get_partner(db: Session, partner_id: int) -> Partner:
    partner = db.get(Partner, partner_id)
    if partner is None:
        raise NotFoundError("Ortak bulunamadı.")
    return partner


def _validate_user_link(db: Session, user_id: int | None, partner_id: int | None) -> None:
    if user_id is None:
        return
    if db.get(User, user_id) is None:
        raise DomainError("Bağlanmak istenen kullanıcı bulunamadı.")
    query = select(Partner.id).where(Partner.user_id == user_id)
    if partner_id is not None:
        query = query.where(Partner.id != partner_id)
    if db.scalar(query) is not None:
        raise ConflictError("Bu kullanıcı zaten başka bir ortağa bağlı.")


def create_partner(
    db: Session, data: PartnerCreate, *, actor: User, context: RequestContext
) -> Partner:
    _validate_user_link(db, data.user_id, None)
    partner = Partner(**data.model_dump())
    db.add(partner)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="partner.create",
        entity_type="partner",
        entity_id=partner.id,
        summary=f"{partner.full_name} ortak olarak eklendi.",
        changes=audit.snapshot(partner, AUDIT_FIELDS),
        context=context,
    )
    db.commit()
    db.refresh(partner)
    return partner


def update_partner(
    db: Session, partner: Partner, data: PartnerUpdate, *, actor: User, context: RequestContext
) -> Partner:
    changes = data.model_dump(exclude_unset=True)
    if "full_name" in changes and changes["full_name"] is None:
        del changes["full_name"]
    if not changes:
        return partner
    if "user_id" in changes:
        _validate_user_link(db, changes["user_id"], partner.id)
    if changes.get("is_active") is False and partner.is_active:
        remaining = [p for p in active_partners(db) if p.id != partner.id]
        if not remaining:
            raise DomainError("En az bir aktif ortak kalmalıdır.")

    before = audit.snapshot(partner, AUDIT_FIELDS)
    for field, value in changes.items():
        setattr(partner, field, value)
    after = audit.snapshot(partner, AUDIT_FIELDS)
    audit.record(
        db,
        actor=actor,
        action="partner.update",
        entity_type="partner",
        entity_id=partner.id,
        summary=f"{partner.full_name} ortak bilgileri güncellendi.",
        changes=audit.diff(before, after),
        context=context,
    )
    db.commit()
    db.refresh(partner)
    return partner
