from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app.core.deps import Context, CurrentUser, DbSession, require
from app.core.permissions import Permission
from app.core.schemas import ApiModel, LongText, Name, Phone, ShortText, blank_to_none
from app.core.updates import update_values
from app.modules.audit import service as audit
from app.modules.settings.models import CompanySettings
from app.modules.users.models import User

router = APIRouter(prefix="/settings", tags=["settings"])

VatRate = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]


class CompanySettingsRead(ApiModel):
    company_name: str
    legal_name: str | None
    phone: str | None
    email: str | None
    website: str | None
    address: str | None
    tax_office: str | None
    tax_number: str | None
    iban: str | None
    default_vat_rate: Decimal
    offer_validity_days: int
    default_payment_terms: str | None
    offer_footer_note: str | None
    season_start_month: int


class CompanySettingsUpdate(ApiModel):
    company_name: Name | None = None
    legal_name: ShortText | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    website: ShortText | None = None
    address: LongText | None = None
    tax_office: ShortText | None = None
    tax_number: ShortText | None = None
    iban: ShortText | None = None
    default_vat_rate: VatRate | None = None
    offer_validity_days: Annotated[int, Field(ge=1, le=365)] | None = None
    default_payment_terms: LongText | None = None
    offer_footer_note: LongText | None = None
    season_start_month: Annotated[int, Field(ge=1, le=12)] | None = None

    @field_validator("*", mode="before")
    @classmethod
    def _blank(cls, value: object) -> object:
        return blank_to_none(value)


FIELDS = list(CompanySettingsUpdate.model_fields)
REQUIRED = {"company_name", "default_vat_rate", "offer_validity_days", "season_start_month"}


def get_company_settings(db: Session) -> CompanySettings:
    """Ayar satırını döner; yoksa varsayılanlarla oluşturur (çağıran işlem commit eder)."""
    settings = db.get(CompanySettings, 1)
    if settings is None:
        settings = CompanySettings(id=1)
        db.add(settings)
        db.flush()
        db.refresh(settings)
    return settings


@router.get("/company", response_model=CompanySettingsRead)
def read_company(db: DbSession, _: CurrentUser) -> CompanySettingsRead:
    settings = get_company_settings(db)
    db.commit()
    return CompanySettingsRead.model_validate(settings)


@router.patch("/company", response_model=CompanySettingsRead)
def update_company(
    data: CompanySettingsUpdate,
    db: DbSession,
    actor: Annotated[User, Depends(require(Permission.SETTINGS_MANAGE))],
    context: Context,
) -> CompanySettingsRead:
    settings = get_company_settings(db)
    changes = update_values(data, REQUIRED)
    if changes:
        if "iban" in changes and changes["iban"]:
            changes["iban"] = changes["iban"].replace(" ", "").upper()
        diff = audit.apply_changes(settings, changes, FIELDS)
        audit.record(
            db,
            actor=actor,
            action="settings.update",
            entity_type="settings",
            entity_id=settings.id,
            summary="Firma ayarları güncellendi.",
            changes=diff,
            context=context,
        )
    db.commit()
    return CompanySettingsRead.model_validate(settings)
