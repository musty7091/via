"""Alembic'in tüm tabloları görebilmesi için her modülün modelleri burada içe aktarılır."""

from app.core.sequences import DocumentSequence
from app.db.base import Base
from app.modules.audit.models import AuditLog
from app.modules.catalog.models import (
    Artist,
    ArtistRiderItem,
    Package,
    PackageItem,
    ServiceItem,
    Supplier,
)
from app.modules.closing.models import AccountingPeriod, EventClosure
from app.modules.customers.models import Customer, CustomerContact, Venue
from app.modules.events.models import Event, EventItem
from app.modules.finance.models import (
    CashAccount,
    CashTransfer,
    Collection,
    Expense,
    JournalEntry,
    JournalLine,
    PartnerTransaction,
    Payable,
    PayablePayment,
    PaymentPlan,
    ReceivableWriteOff,
)
from app.modules.offers.models import Offer, OfferLine
from app.modules.operations.models import EventTask, OperationReport, RiderCheck
from app.modules.partners.models import Partner
from app.modules.rates.models import ExchangeRate
from app.modules.settings.models import CompanySettings
from app.modules.users.models import User

__all__ = [
    "AccountingPeriod",
    "EventClosure",
    "ReceivableWriteOff",
    "CashAccount",
    "CashTransfer",
    "Collection",
    "Expense",
    "JournalEntry",
    "JournalLine",
    "PartnerTransaction",
    "Payable",
    "PayablePayment",
    "PaymentPlan",
    "Artist",
    "ArtistRiderItem",
    "AuditLog",
    "Base",
    "CompanySettings",
    "Customer",
    "CustomerContact",
    "DocumentSequence",
    "Event",
    "EventItem",
    "Offer",
    "EventTask",
    "OperationReport",
    "RiderCheck",
    "OfferLine",
    "Package",
    "PackageItem",
    "Partner",
    "ExchangeRate",
    "ServiceItem",
    "Supplier",
    "User",
    "Venue",
]
