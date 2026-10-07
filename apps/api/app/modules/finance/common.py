"""Finans servislerinin ortak kontrolleri."""

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import DomainError
from app.core.money import BASE_CURRENCY, ZERO, Currency, format_money, money
from app.modules.finance import ledger
from app.modules.finance.models import Account, CashAccount
from app.modules.partners.models import Partner

RATE_STEP = Decimal("0.000001")


def require_rate(currency: Currency | str, rate: Decimal | None) -> Decimal:
    if currency == BASE_CURRENCY:
        return Decimal("1")
    if rate is None or rate <= 0:
        raise DomainError(f"{currency} işlem için TL kuru girilmelidir.")
    return rate


def check_date(day: date) -> None:
    if day > clock.today():
        raise DomainError("İleri tarihli finans kaydı girilemez.")


def get_cash_account(
    db: Session, account_id: int, currency: Currency | str | None = None
) -> CashAccount:
    account = db.get(CashAccount, account_id)
    if account is None or not account.is_active:
        raise DomainError("Seçilen kasa/banka hesabı bulunamadı veya pasif.")
    if currency is not None and account.currency != currency:
        raise DomainError(
            f"{account.name} {account.currency} hesabıdır; {currency} işlem bu hesaba girilemez."
        )
    return account


def get_partner(db: Session, partner_id: int) -> Partner:
    partner = db.get(Partner, partner_id)
    if partner is None or not partner.is_active:
        raise DomainError("Seçilen ortak bulunamadı veya pasif.")
    return partner


def carrying(
    db: Session, account: Account, currency: str, **filters: object
) -> tuple[Decimal, Decimal]:
    """Bir hesabın belirli para birimindeki bakiyesi: (orijinal tutar, TL karşılığı)."""
    amount = ledger.amount_balance(db, account, currency=currency, **filters).get(currency, ZERO)
    base = ledger.balance(db, account, currency=currency, **filters)
    return amount, base


def proportional_base(held_amount: Decimal, held_base: Decimal, amount: Decimal) -> Decimal:
    """Bakiyeden bir kısmı çıkarken TL karşılığını orantılı hesaplar; tamamı çıkıyorsa
    kalan TL karşılığının tamamını döner (kuruş artığı kalmaz)."""
    if amount == held_amount:
        return held_base
    return money(held_base * amount / held_amount)


def implied_rate(base: Decimal, amount: Decimal) -> Decimal:
    return (abs(base) / abs(amount)).quantize(RATE_STEP) if amount else Decimal("1")


def assert_cash_available(
    db: Session, account: CashAccount, amount: Decimal, on_date: date | None = None
) -> None:
    """Kasa ve banka asla eksiye düşemez. Geriye tarihli çıkışta hem o tarihteki hem
    bugünkü bakiye yetmelidir (geçmiş bir ayın raporunda eksi bakiye oluşmasın)."""
    held = ledger.amount_balance(db, Account.CASH, cash_account_id=account.id).get(
        account.currency, ZERO
    )
    as_of_text = ""
    if on_date is not None and on_date < clock.today():
        held_then = ledger.amount_balance(
            db, Account.CASH, as_of=on_date, cash_account_id=account.id
        ).get(account.currency, ZERO)
        if held_then < held:
            held, as_of_text = held_then, f" {on_date:%d.%m.%Y} tarihinde"
    if amount > held:
        raise DomainError(
            f"{account.name} hesabında{as_of_text} yeterli bakiye yok "
            f"(bakiye {format_money(held, account.currency)}, "
            f"gereken {format_money(amount, account.currency)})."
        )
