"""Muhasebe motoru veri modeli.

Çift taraflı defter: her iş olayı bir `JournalEntry` (fiş) üretir; fişin satırları
(`JournalLine`) TL karşılığında borç = alacak olacak şekilde dengelidir.
Kayıtlar asla silinmez veya değiştirilmez; iptal, ters kayıt (storno) ile yapılır.

İş belgeleri (tahsilat, borç, ödeme, gider...) kullanıcının gördüğü kayıtlardır;
her biri defterdeki fişine bağlıdır.
"""

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.money import Currency
from app.db.base import Base, RateColumn, TimestampMixin
from app.modules.catalog.models import Artist, Supplier
from app.modules.customers.models import Customer
from app.modules.events.models import Event
from app.modules.partners.models import Partner
from app.modules.users.models import User


class Account(StrEnum):
    """Hesap planı (sade). Tutarlar TL karşılığıyla tutulur."""

    CASH = "cash"  # kasa / banka (cash_account_id)
    CUSTOMER_RECEIVABLE = "customer_receivable"  # müşteri alacağı (customer_id, event_id)
    PARTNER_CASH = "partner_cash"  # ortak üzerindeki şirket parası (partner_id)
    SUPPLIER_PAYABLE = "supplier_payable"  # sanatçı/tedarikçi borcu (payable_id)
    PARTNER_PAYABLE = "partner_payable"  # şirketin ortağa borcu (partner_id)
    VAT_PAYABLE = "vat_payable"  # ödenecek KDV
    REVENUE = "revenue"  # etkinlik geliri (event_id)
    EVENT_COST = "event_cost"  # sanatçı/hizmet maliyeti (event_id)
    EXPENSE = "expense"  # gider (event_id varsa etkinlik gideri)
    FX_DIFFERENCE = "fx_difference"  # kur farkı (+ gider / − gelir)
    # Ortaklara dağıtılan kâr (+) / yansıtılan zarar (−); özkaynak hesabı (event_id varsa etkinlik)
    PROFIT_DISTRIBUTED = "profit_distributed"


class EntryKind(StrEnum):
    AGREEMENT = "agreement"
    PAYABLE = "payable"
    PAYABLE_ADJUSTMENT = "payable_adjustment"
    COLLECTION = "collection"
    SUPPLIER_PAYMENT = "supplier_payment"
    EXPENSE = "expense"
    PARTNER_HANDOVER = "partner_handover"
    PARTNER_PAYOUT = "partner_payout"
    PARTNER_OFFSET = "partner_offset"
    CASH_TRANSFER = "cash_transfer"
    WRITE_OFF = "write_off"
    EVENT_CLOSE = "event_close"
    PERIOD_CLOSE = "period_close"
    REVERSAL = "reversal"


class DocStatus(StrEnum):
    ACTIVE = "active"
    CANCELLED = "cancelled"


class CashAccountType(StrEnum):
    CASH = "cash"
    BANK = "bank"


class PaymentMethod(StrEnum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CARD = "card"
    CHEQUE = "cheque"
    OTHER = "other"


class CashAccount(TimestampMixin, Base):
    """Kasa veya banka hesabı. Her hesabın tek para birimi vardır."""

    __tablename__ = "cash_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    account_type: Mapped[CashAccountType] = mapped_column(String(10))
    currency: Mapped[Currency] = mapped_column(String(3))
    iban: Mapped[str | None] = mapped_column(String(40))
    is_active: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)


# --- Defter ---


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_no: Mapped[str] = mapped_column(String(30), unique=True)
    entry_date: Mapped[date] = mapped_column(Date, index=True)
    kind: Mapped[EntryKind] = mapped_column(String(30), index=True)
    description: Mapped[str] = mapped_column(String(300))
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), index=True)
    # Bu fiş hangi fişi ters çeviriyor?
    reverses_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"), unique=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    lines: Mapped[list["JournalLine"]] = relationship(
        back_populates="entry", cascade="all, delete-orphan", order_by="JournalLine.id"
    )


class JournalLine(Base):
    __tablename__ = "journal_lines"
    __table_args__ = (
        CheckConstraint("debit >= 0 AND credit >= 0", name="non_negative"),
        CheckConstraint("(debit = 0) <> (credit = 0)", name="one_side"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id"), index=True)
    entry: Mapped[JournalEntry] = relationship(back_populates="lines")
    account: Mapped[Account] = mapped_column(String(30), index=True)
    # TL karşılığı; satırın tek tarafı doludur.
    debit: Mapped[Decimal] = mapped_column(default=Decimal("0"))
    credit: Mapped[Decimal] = mapped_column(default=Decimal("0"))
    # Orijinal para birimindeki tutar (işaretli: borç +, alacak −) ve kur
    amount: Mapped[Decimal]
    currency: Mapped[Currency] = mapped_column(String(3))
    rate: Mapped[Decimal] = mapped_column(RateColumn)

    # Taraflar (hesaba göre ilgili olanlar dolu)
    cash_account_id: Mapped[int | None] = mapped_column(ForeignKey("cash_accounts.id"), index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"), index=True)
    partner_id: Mapped[int | None] = mapped_column(ForeignKey("partners.id"), index=True)
    payable_id: Mapped[int | None] = mapped_column(ForeignKey("payables.id"), index=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), index=True)
    memo: Mapped[str | None] = mapped_column(String(300))


# --- İş belgeleri ---


class PaymentPlan(TimestampMixin, Base):
    """Müşteriden beklenen ödeme takvimi (muhasebe kaydı değildir)."""

    __tablename__ = "payment_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    due_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal]  # etkinlik para biriminde
    sort_order: Mapped[int] = mapped_column(default=0)


class Collection(TimestampMixin, Base):
    """Müşteriden tahsilat. Para şirket kasasına/bankasına ya da bir ortağın eline girer."""

    __tablename__ = "collections"
    __table_args__ = (
        CheckConstraint(
            "(cash_account_id IS NULL) <> (partner_id IS NULL)", name="one_destination"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    collection_no: Mapped[str] = mapped_column(String(30), unique=True)
    status: Mapped[DocStatus] = mapped_column(String(10), default=DocStatus.ACTIVE, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    event: Mapped[Event] = relationship()
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    customer: Mapped[Customer] = relationship()
    collection_date: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[Decimal]
    currency: Mapped[Currency] = mapped_column(String(3))
    rate: Mapped[Decimal] = mapped_column(RateColumn)
    # Etkinlik para biriminde müşteri borcundan düşülen tutar
    applied_amount: Mapped[Decimal]
    cash_account_id: Mapped[int | None] = mapped_column(ForeignKey("cash_accounts.id"))
    cash_account: Mapped[CashAccount | None] = relationship()
    partner_id: Mapped[int | None] = mapped_column(ForeignKey("partners.id"))
    partner: Mapped[Partner | None] = relationship()
    method: Mapped[PaymentMethod] = mapped_column(String(20))
    document_no: Mapped[str | None] = mapped_column(String(60))
    note: Mapped[str | None] = mapped_column(Text)
    entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id"))
    cancel_reason: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_by: Mapped[User | None] = relationship()


class Payable(TimestampMixin, Base):
    """Sanatçıya / tedarikçiye borç. Anlaşmada etkinlik kalemlerinden otomatik açılır
    veya ödenmemiş giderden doğar."""

    __tablename__ = "payables"

    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[DocStatus] = mapped_column(String(10), default=DocStatus.ACTIVE, index=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), index=True)
    event: Mapped[Event | None] = relationship()
    event_item_id: Mapped[int | None] = mapped_column(ForeignKey("event_items.id"), index=True)
    expense_id: Mapped[int | None] = mapped_column(ForeignKey("expenses.id"), unique=True)
    artist_id: Mapped[int | None] = mapped_column(ForeignKey("artists.id"), index=True)
    artist: Mapped[Artist | None] = relationship()
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"), index=True)
    supplier: Mapped[Supplier | None] = relationship()
    title: Mapped[str] = mapped_column(String(200))
    amount: Mapped[Decimal]
    currency: Mapped[Currency] = mapped_column(String(3))
    rate: Mapped[Decimal] = mapped_column(RateColumn)  # borç kaydı kuru
    due_date: Mapped[date | None] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(Text)
    cancel_reason: Mapped[str | None] = mapped_column(Text)


class PayablePayment(TimestampMixin, Base):
    __tablename__ = "payable_payments"
    __table_args__ = (
        CheckConstraint("(cash_account_id IS NULL) <> (partner_id IS NULL)", name="one_source"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    payment_no: Mapped[str] = mapped_column(String(30), unique=True)
    status: Mapped[DocStatus] = mapped_column(String(10), default=DocStatus.ACTIVE, index=True)
    payable_id: Mapped[int] = mapped_column(ForeignKey("payables.id"), index=True)
    payable: Mapped[Payable] = relationship()
    payment_date: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[Decimal]
    currency: Mapped[Currency] = mapped_column(String(3))
    rate: Mapped[Decimal] = mapped_column(RateColumn)
    # Borç para biriminde kapatılan tutar
    applied_amount: Mapped[Decimal]
    cash_account_id: Mapped[int | None] = mapped_column(ForeignKey("cash_accounts.id"))
    cash_account: Mapped[CashAccount | None] = relationship()
    # Ödemeyi ortak kendi cebinden yaptıysa: şirket ortağa borçlanır
    partner_id: Mapped[int | None] = mapped_column(ForeignKey("partners.id"))
    partner: Mapped[Partner | None] = relationship()
    method: Mapped[PaymentMethod] = mapped_column(String(20))
    document_no: Mapped[str | None] = mapped_column(String(60))
    note: Mapped[str | None] = mapped_column(Text)
    entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id"))
    cancel_reason: Mapped[str | None] = mapped_column(Text)


class ExpenseCategory(StrEnum):
    RENT = "rent"
    SALARY = "salary"
    TRANSPORT = "transport"
    MARKETING = "marketing"
    OFFICE = "office"
    TAX_FEES = "tax_fees"
    EQUIPMENT = "equipment"
    FOOD = "food"
    OTHER = "other"


class ExpensePaidBy(StrEnum):
    COMPANY = "company"  # kasadan/bankadan ödendi
    PARTNER = "partner"  # ortak cebinden ödedi
    UNPAID = "unpaid"  # henüz ödenmedi (tedarikçi borcu açılır)


class ExpenseAllocation(StrEnum):
    """Genel giderin hangi aylara ait olduğu."""

    MONTH = "month"  # sadece gider ayına
    SEASON = "season"  # sezonun tüm aylarına (geçmiş ayların payı gider ayına yazılır)
    REST_OF_SEASON = "rest_of_season"  # gider ayından sezon sonuna kadar


class Expense(TimestampMixin, Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    expense_no: Mapped[str] = mapped_column(String(30), unique=True)
    status: Mapped[DocStatus] = mapped_column(String(10), default=DocStatus.ACTIVE, index=True)
    expense_date: Mapped[date] = mapped_column(Date, index=True)
    category: Mapped[ExpenseCategory] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(200))
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), index=True)
    event: Mapped[Event | None] = relationship()
    amount: Mapped[Decimal]
    currency: Mapped[Currency] = mapped_column(String(3))
    rate: Mapped[Decimal] = mapped_column(RateColumn)
    allocation: Mapped[ExpenseAllocation] = mapped_column(
        String(15), default=ExpenseAllocation.MONTH, server_default="month"
    )
    # Aylara bölünen genel giderin ait olduğu aralık (YYYY-AA). Payı gider ayından önceki
    # aylara düşenler gider ayına yazılır; kapanmış aylara geriye dönük kayıt yapılmaz.
    spread_from: Mapped[str | None] = mapped_column(String(7))
    spread_until: Mapped[str | None] = mapped_column(String(7))
    paid_by: Mapped[ExpensePaidBy] = mapped_column(String(10))
    cash_account_id: Mapped[int | None] = mapped_column(ForeignKey("cash_accounts.id"))
    cash_account: Mapped[CashAccount | None] = relationship()
    partner_id: Mapped[int | None] = mapped_column(ForeignKey("partners.id"))
    partner: Mapped[Partner | None] = relationship()
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"))
    supplier: Mapped[Supplier | None] = relationship()
    document_no: Mapped[str | None] = mapped_column(String(60))
    note: Mapped[str | None] = mapped_column(Text)
    # Ödenmemiş giderde borç kaydı fişten önce oluştuğu için kısa süre boş kalabilir.
    entry_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    cancel_reason: Mapped[str | None] = mapped_column(Text)


class PartnerTxKind(StrEnum):
    HANDOVER = "handover"  # ortak elindeki şirket parasını kasaya teslim etti
    PAYOUT = "payout"  # şirket ortağa ödeme yaptı (borcunu kapattı)
    OFFSET = "offset"  # ortağın elindeki para ile şirketin ona borcu mahsup edildi


class PartnerTransaction(TimestampMixin, Base):
    __tablename__ = "partner_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[DocStatus] = mapped_column(String(10), default=DocStatus.ACTIVE, index=True)
    kind: Mapped[PartnerTxKind] = mapped_column(String(10))
    partner_id: Mapped[int] = mapped_column(ForeignKey("partners.id"), index=True)
    partner: Mapped[Partner] = relationship()
    tx_date: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[Decimal]
    currency: Mapped[Currency] = mapped_column(String(3))
    rate: Mapped[Decimal] = mapped_column(RateColumn)
    cash_account_id: Mapped[int | None] = mapped_column(ForeignKey("cash_accounts.id"))
    cash_account: Mapped[CashAccount | None] = relationship()
    note: Mapped[str | None] = mapped_column(Text)
    entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id"))
    cancel_reason: Mapped[str | None] = mapped_column(Text)


class CashTransfer(TimestampMixin, Base):
    """Kasalar/bankalar arası transfer (ör. kasadan bankaya yatırma, döviz bozdurma)."""

    __tablename__ = "cash_transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[DocStatus] = mapped_column(String(10), default=DocStatus.ACTIVE, index=True)
    transfer_date: Mapped[date] = mapped_column(Date, index=True)
    from_account_id: Mapped[int] = mapped_column(ForeignKey("cash_accounts.id"))
    from_account: Mapped[CashAccount] = relationship(foreign_keys=[from_account_id])
    to_account_id: Mapped[int] = mapped_column(ForeignKey("cash_accounts.id"))
    to_account: Mapped[CashAccount] = relationship(foreign_keys=[to_account_id])
    from_amount: Mapped[Decimal]
    from_rate: Mapped[Decimal] = mapped_column(RateColumn)
    to_amount: Mapped[Decimal]
    to_rate: Mapped[Decimal] = mapped_column(RateColumn)
    note: Mapped[str | None] = mapped_column(Text)
    entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id"))
    cancel_reason: Mapped[str | None] = mapped_column(Text)


class ReceivableWriteOff(TimestampMixin, Base):
    """Tahsil edilemeyen müşteri alacağının silinmesi (gider olarak kârdan düşer)."""

    __tablename__ = "receivable_write_offs"

    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[DocStatus] = mapped_column(String(10), default=DocStatus.ACTIVE, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    amount: Mapped[Decimal]  # etkinlik para biriminde
    reason: Mapped[str] = mapped_column(Text)
    entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id"))
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
