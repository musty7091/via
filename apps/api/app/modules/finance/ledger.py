"""Defter: fiş kaydetme, ters kayıt ve bakiye sorguları.

Tüm finans servisleri deftere SADECE buradan yazar. `post` dengesiz bir fişi
kesinlikle kaydetmez: TL karşılığında borç toplamı alacak toplamına kuruşu
kuruşuna eşit olmalıdır.
"""

from dataclasses import dataclass, replace
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import DomainError
from app.core.money import BASE_CURRENCY, ZERO, Currency, money
from app.core.sequences import next_number
from app.modules.finance.models import Account, EntryKind, JournalEntry, JournalLine
from app.modules.users.models import User


class UnbalancedEntryError(RuntimeError):
    """Programlama hatası: dengesiz fiş. Kullanıcıya gösterilmez, işlem geri alınır."""


@dataclass(frozen=True)
class Leg:
    """Fiş satırı taslağı. `base` TL karşılığıdır: + borç, − alacak."""

    account: Account
    base: Decimal
    amount: Decimal
    currency: Currency
    rate: Decimal
    cash_account_id: int | None = None
    customer_id: int | None = None
    partner_id: int | None = None
    payable_id: int | None = None
    event_id: int | None = None
    memo: str | None = None

    def negated(self) -> "Leg":
        return replace(self, base=-self.base, amount=-self.amount)


def leg(
    account: Account,
    amount: Decimal,
    currency: Currency | str,
    rate: Decimal,
    *,
    credit: bool = False,
    **parties: object,
) -> Leg:
    """Orijinal tutardan satır üretir; TL karşılığı kuruşa yuvarlanır."""
    base = money(amount * rate)
    sign = Decimal(-1) if credit else Decimal(1)
    return Leg(
        account=account,
        base=sign * base,
        amount=sign * money(amount),
        currency=Currency(currency),
        rate=rate,
        **parties,  # type: ignore[arg-type]
    )


def base_leg(account: Account, base: Decimal, **parties: object) -> Leg:
    """Doğrudan TL tutarlı satır (+ borç, − alacak)."""
    base = money(base)
    return Leg(
        account=account,
        base=base,
        amount=base,
        currency=BASE_CURRENCY,
        rate=Decimal("1"),
        **parties,  # type: ignore[arg-type]
    )


def balancing_fx_leg(legs: list[Leg], **parties: object) -> Leg | None:
    """Kur farkından doğan dengesizliği kur farkı hesabına yazar.

    Örn. 1.000 € alacak 36,00 kurdan kaydedilmiş, 37,00 kurdan tahsil edilmişse
    1.000 TL kur farkı geliri (alacak) oluşur.
    """
    diff = -sum((item.base for item in legs), ZERO)
    if diff == 0:
        return None
    return base_leg(Account.FX_DIFFERENCE, diff, memo="Kur farkı", **parties)


def ensure_period_open(db: Session, entry_date: date) -> None:
    """Kapanmış döneme kayıt yapılmasını engeller (dönem kapanışı Aşama 5'te bağlanır)."""
    from app.modules.closing.service import assert_period_open  # noqa: PLC0415

    assert_period_open(db, entry_date)


def post(
    db: Session,
    *,
    kind: EntryKind,
    entry_date: date,
    description: str,
    legs: list[Leg],
    actor: User | None,
    event_id: int | None = None,
    reverses_id: int | None = None,
) -> JournalEntry:
    legs = [item for item in legs if item.base != 0 or item.amount != 0]
    if len(legs) < 2:
        raise UnbalancedEntryError("Fiş en az iki satırdan oluşmalıdır.")
    total = sum((item.base for item in legs), ZERO)
    if total != 0:
        raise UnbalancedEntryError(f"Dengesiz fiş: fark {total} TL ({description}).")
    if any(item.base == 0 for item in legs):
        raise UnbalancedEntryError("TL karşılığı sıfır olan satır kaydedilemez.")
    ensure_period_open(db, entry_date)

    entry = JournalEntry(
        entry_no=next_number(db, "journal", entry_date.year, "VIA-M"),
        entry_date=entry_date,
        kind=kind,
        description=description[:300],
        event_id=event_id,
        reverses_id=reverses_id,
        created_by_id=actor.id if actor else None,
    )
    for item in legs:
        entry.lines.append(
            JournalLine(
                account=item.account,
                debit=item.base if item.base > 0 else ZERO,
                credit=-item.base if item.base < 0 else ZERO,
                amount=item.amount,
                currency=item.currency,
                rate=item.rate,
                cash_account_id=item.cash_account_id,
                customer_id=item.customer_id,
                partner_id=item.partner_id,
                payable_id=item.payable_id,
                event_id=item.event_id,
                memo=item.memo,
            )
        )
    db.add(entry)
    db.flush()
    return entry


def reverse(
    db: Session, entry: JournalEntry, *, entry_date: date, description: str, actor: User | None
) -> JournalEntry:
    """Fişi ters kayıtla iptal eder; orijinal fiş olduğu gibi kalır."""
    if db.scalar(select(JournalEntry.id).where(JournalEntry.reverses_id == entry.id)):
        raise DomainError("Bu kayıt zaten iptal edilmiş.")
    legs = [
        Leg(
            account=Account(line.account),
            base=line.credit - line.debit,
            amount=-line.amount,
            currency=Currency(line.currency),
            rate=line.rate,
            cash_account_id=line.cash_account_id,
            customer_id=line.customer_id,
            partner_id=line.partner_id,
            payable_id=line.payable_id,
            event_id=line.event_id,
            memo=line.memo,
        )
        for line in entry.lines
    ]
    return post(
        db,
        kind=EntryKind.REVERSAL,
        entry_date=entry_date,
        description=description,
        legs=legs,
        actor=actor,
        event_id=entry.event_id,
        reverses_id=entry.id,
    )


def _apply(query, filters: dict[str, object], as_of: date | None):  # noqa: ANN001, ANN202
    for key, value in filters.items():
        query = query.where(getattr(JournalLine, key) == value)
    if as_of is not None:
        query = query.join(JournalEntry, JournalEntry.id == JournalLine.entry_id).where(
            JournalEntry.entry_date <= as_of
        )
    return query


def balance(
    db: Session, account: Account, *, as_of: date | None = None, **filters: object
) -> Decimal:
    """Hesap bakiyesi, TL (borç − alacak). `as_of` verilirse o tarih sonu itibarıyla."""
    query = select(func.coalesce(func.sum(JournalLine.debit - JournalLine.credit), 0)).where(
        JournalLine.account == account
    )
    return money(db.scalar(_apply(query, filters, as_of)))


def amount_balance(
    db: Session, account: Account, *, as_of: date | None = None, **filters: object
) -> dict[str, Decimal]:
    """Hesap bakiyesi, orijinal para birimlerine göre."""
    query = (
        select(JournalLine.currency, func.sum(JournalLine.amount))
        .where(JournalLine.account == account)
        .group_by(JournalLine.currency)
    )
    return {
        currency: money(total)
        for currency, total in db.execute(_apply(query, filters, as_of))
        if total != 0
    }
