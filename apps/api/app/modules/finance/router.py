from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select

from app.core import clock
from app.core.deps import Context, DbSession, require
from app.core.errors import DomainError, NotFoundError
from app.core.permissions import Permission
from app.core.schemas import Page
from app.modules.audit import service as audit
from app.modules.catalog.models import Artist, Supplier
from app.modules.customers.service import get_customer
from app.modules.events.models import Event, EventStatus
from app.modules.events.service import get_event
from app.modules.finance import (
    cash,
    collections,
    expenses,
    general_expenses,
    partners,
    payables,
    reports,
)
from app.modules.finance.models import (
    CashAccount,
    CashTransfer,
    Collection,
    DocStatus,
    Expense,
    ExpenseCategory,
    PartnerTransaction,
    Payable,
    PayablePayment,
    PaymentPlan,
)
from app.modules.finance.schemas import (
    CancelRequest,
    CashAccountCreate,
    CashAccountRead,
    CashAccountUpdate,
    CollectionCreate,
    CollectionRead,
    EventFinance,
    ExpenseCreate,
    ExpenseRead,
    FinanceOverview,
    Movement,
    PartnerBalance,
    PartnerTxCreate,
    PartnerTxRead,
    PayableCreate,
    PayableRead,
    PayableUpdate,
    PaymentCreate,
    PaymentPlanCreate,
    PaymentPlanRead,
    PaymentPlanUpdate,
    StatementLine,
    TransferCreate,
)
from app.modules.partners.service import get_partner
from app.modules.users.models import User

router = APIRouter(prefix="/finance", tags=["finance"])

Viewer = Annotated[User, Depends(require(Permission.FINANCE_VIEW))]
Recorder = Annotated[User, Depends(require(Permission.FINANCE_RECORD))]
Admin = Annotated[User, Depends(require(Permission.SETTINGS_MANAGE))]
Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=200)]


# --- Özet ---


@router.get("/overview", response_model=FinanceOverview)
def overview(db: DbSession, _: Viewer) -> FinanceOverview:
    return reports.overview(db)


@router.get("/events/{event_id}", response_model=EventFinance)
def event_finance(event_id: int, db: DbSession, _: Viewer) -> EventFinance:
    return reports.event_finance(db, get_event(db, event_id))


@router.get("/customers/{customer_id}/statement", response_model=list[StatementLine])
def customer_statement(customer_id: int, db: DbSession, _: Viewer) -> list[StatementLine]:
    get_customer(db, customer_id)
    return reports.customer_statement(db, customer_id)


# --- Kasa / banka ---


@router.get("/artists/{artist_id}/statement", response_model=list[StatementLine])
def artist_statement(artist_id: int, db: DbSession, _: Viewer) -> list[StatementLine]:
    if db.get(Artist, artist_id) is None:
        raise NotFoundError("Sanatçı bulunamadı.")
    return reports.payee_statement(db, artist_id=artist_id)


@router.get("/suppliers/{supplier_id}/statement", response_model=list[StatementLine])
def supplier_statement(supplier_id: int, db: DbSession, _: Viewer) -> list[StatementLine]:
    if db.get(Supplier, supplier_id) is None:
        raise NotFoundError("Tedarikçi bulunamadı.")
    return reports.payee_statement(db, supplier_id=supplier_id)


@router.get("/cash-accounts", response_model=list[CashAccountRead])
def list_cash_accounts(
    db: DbSession, _: Viewer, include_inactive: bool = False
) -> list[CashAccountRead]:
    query = select(CashAccount).order_by(CashAccount.sort_order, CashAccount.id)
    if not include_inactive:
        query = query.where(CashAccount.is_active.is_(True))
    return [reports.cash_account_read(db, a) for a in db.scalars(query)]


@router.post("/cash-accounts", response_model=CashAccountRead, status_code=status.HTTP_201_CREATED)
def create_cash_account(
    data: CashAccountCreate, db: DbSession, actor: Admin, context: Context
) -> CashAccountRead:
    account = cash.create_account(db, **data.model_dump(), actor=actor, context=context)
    return reports.cash_account_read(db, account)


@router.patch("/cash-accounts/{account_id}", response_model=CashAccountRead)
def update_cash_account(
    account_id: int, data: CashAccountUpdate, db: DbSession, actor: Admin, context: Context
) -> CashAccountRead:
    changes = {
        k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None or k == "iban"
    }
    account = cash.update_account(
        db, cash.get_account(db, account_id), changes, actor=actor, context=context
    )
    return reports.cash_account_read(db, account)


@router.get("/cash-accounts/{account_id}/movements", response_model=list[Movement])
def cash_movements(account_id: int, db: DbSession, _: Viewer) -> list[Movement]:
    return reports.cash_movements(db, cash.get_account(db, account_id))


@router.post("/transfers", status_code=status.HTTP_201_CREATED)
def create_transfer(data: TransferCreate, db: DbSession, actor: Recorder, context: Context) -> dict:
    tx = cash.transfer(db, **data.model_dump(), actor=actor, context=context)
    return {"id": tx.id}


@router.post("/transfers/{transfer_id}/cancel")
def cancel_transfer(
    transfer_id: int, data: CancelRequest, db: DbSession, actor: Recorder, context: Context
) -> dict:
    tx = db.get(CashTransfer, transfer_id)
    if tx is None:
        raise NotFoundError("Transfer bulunamadı.")
    cash.cancel_transfer(db, tx, data.reason, actor=actor, context=context)
    return {"id": tx.id}


# --- Tahsilatlar ---


@router.get("/collections", response_model=Page[CollectionRead])
def list_collections(
    db: DbSession,
    _: Viewer,
    event_id: int | None = None,
    customer_id: int | None = None,
    partner_id: int | None = None,
    status_filter: Annotated[DocStatus | None, Query(alias="status")] = None,
    date_from: date | None = None,
    date_to: date | None = None,
    offset: Offset = 0,
    limit: Limit = 50,
) -> Page[CollectionRead]:
    query = select(Collection)
    for column, value in (
        (Collection.event_id, event_id),
        (Collection.customer_id, customer_id),
        (Collection.partner_id, partner_id),
        (Collection.status, status_filter),
    ):
        if value is not None:
            query = query.where(column == value)
    if date_from:
        query = query.where(Collection.collection_date >= date_from)
    if date_to:
        query = query.where(Collection.collection_date <= date_to)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(Collection.collection_date.desc(), Collection.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return Page(items=[reports.collection_read(c) for c in rows], total=total)


@router.post("/collections", response_model=CollectionRead, status_code=status.HTTP_201_CREATED)
def create_collection(
    data: CollectionCreate, db: DbSession, actor: Recorder, context: Context
) -> CollectionRead:
    values = data.model_dump()
    event = get_event(db, values.pop("event_id"))
    collection = collections.create_collection(
        db, event=event, **values, actor=actor, context=context
    )
    return reports.collection_read(collection)


@router.post("/collections/{collection_id}/cancel", response_model=CollectionRead)
def cancel_collection(
    collection_id: int, data: CancelRequest, db: DbSession, actor: Recorder, context: Context
) -> CollectionRead:
    collection = collections.cancel_collection(
        db, collections.get_collection(db, collection_id), data.reason, actor=actor, context=context
    )
    return reports.collection_read(collection)


# --- Borçlar ve ödemeler ---


@router.get("/payables", response_model=Page[PayableRead])
def list_payables(
    db: DbSession,
    _: Viewer,
    state: Annotated[str | None, Query(pattern="^(open|paid|all)$")] = "open",
    event_id: int | None = None,
    artist_id: int | None = None,
    supplier_id: int | None = None,
    offset: Offset = 0,
    limit: Limit = 50,
) -> Page[PayableRead]:
    query = select(Payable).where(Payable.status == DocStatus.ACTIVE)
    for column, value in (
        (Payable.event_id, event_id),
        (Payable.artist_id, artist_id),
        (Payable.supplier_id, supplier_id),
    ):
        if value is not None:
            query = query.where(column == value)
    rows = [
        reports.payable_read(db, p)
        for p in db.scalars(query.order_by(Payable.due_date.nulls_last(), Payable.id))
    ]
    if state == "open":
        rows = [r for r in rows if r.state in {"open", "partial"}]
    elif state == "paid":
        rows = [r for r in rows if r.state == "paid"]
    return Page(items=rows[offset : offset + limit], total=len(rows))


@router.post("/payables", response_model=PayableRead, status_code=status.HTTP_201_CREATED)
def create_payable(
    data: PayableCreate, db: DbSession, actor: Recorder, context: Context
) -> PayableRead:
    values = data.model_dump()
    event = get_event(db, values.pop("event_id"))
    payable = payables.create_payable(db, event=event, **values, actor=actor, context=context)
    return reports.payable_read(db, payable)


@router.patch("/payables/{payable_id}", response_model=PayableRead)
def update_payable(
    payable_id: int, data: PayableUpdate, db: DbSession, actor: Recorder, context: Context
) -> PayableRead:
    changes = data.model_dump(exclude_unset=True)
    changes = {
        k: v
        for k, v in changes.items()
        if v is not None or k in {"artist_id", "supplier_id", "due_date", "note"}
    }
    payable = payables.update_payable(
        db, payables.get_payable(db, payable_id), changes, actor=actor, context=context
    )
    return reports.payable_read(db, payable)


@router.post("/payables/{payable_id}/cancel", response_model=PayableRead)
def cancel_payable(
    payable_id: int, data: CancelRequest, db: DbSession, actor: Recorder, context: Context
) -> PayableRead:
    payable = payables.cancel_payable(
        db, payables.get_payable(db, payable_id), data.reason, actor=actor, context=context
    )
    return reports.payable_read(db, payable)


@router.post(
    "/payables/{payable_id}/payments",
    response_model=PayableRead,
    status_code=status.HTTP_201_CREATED,
)
def pay_payable(
    payable_id: int, data: PaymentCreate, db: DbSession, actor: Recorder, context: Context
) -> PayableRead:
    payable = payables.get_payable(db, payable_id)
    payables.pay(db, payable, **data.model_dump(), actor=actor, context=context)
    return reports.payable_read(db, payable)


@router.post("/payments/{payment_id}/cancel", response_model=PayableRead)
def cancel_payment(
    payment_id: int, data: CancelRequest, db: DbSession, actor: Recorder, context: Context
) -> PayableRead:
    payment = db.get(PayablePayment, payment_id)
    if payment is None:
        raise NotFoundError("Ödeme bulunamadı.")
    payables.cancel_payment(db, payment, data.reason, actor=actor, context=context)
    return reports.payable_read(db, payment.payable)


# --- Giderler ---


@router.get("/expenses", response_model=Page[ExpenseRead])
def list_expenses(
    db: DbSession,
    _: Viewer,
    month: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
    category: ExpenseCategory | None = None,
    event_id: int | None = None,
    include_cancelled: bool = False,
    offset: Offset = 0,
    limit: Limit = 50,
) -> Page[ExpenseRead]:
    query = select(Expense)
    if not include_cancelled:
        query = query.where(Expense.status == DocStatus.ACTIVE)
    if month:
        year, mon = (int(x) for x in month.split("-"))
        start = date(year, mon, 1)
        end = date(year + (mon == 12), mon % 12 + 1, 1)
        query = query.where(Expense.expense_date >= start, Expense.expense_date < end)
    if category:
        query = query.where(Expense.category == category)
    if event_id is not None:
        query = query.where(Expense.event_id == event_id)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(Expense.expense_date.desc(), Expense.id.desc()).offset(offset).limit(limit)
    ).all()
    return Page(items=[reports.expense_read(db, e) for e in rows], total=total)


@router.post("/expenses", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense(
    data: ExpenseCreate, db: DbSession, actor: Recorder, context: Context
) -> ExpenseRead:
    expense = expenses.create_expense(db, **data.model_dump(), actor=actor, context=context)
    return reports.expense_read(db, expense)


@router.post("/expenses/{expense_id}/cancel", response_model=ExpenseRead)
def cancel_expense(
    expense_id: int, data: CancelRequest, db: DbSession, actor: Recorder, context: Context
) -> ExpenseRead:
    expense = expenses.cancel_expense(
        db, expenses.get_expense(db, expense_id), data.reason, actor=actor, context=context
    )
    return reports.expense_read(db, expense)


@router.get("/general-expenses", response_model=general_expenses.GeneralExpenses)
def get_general_expenses(
    db: DbSession,
    _: Viewer,
    month: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
) -> general_expenses.GeneralExpenses:
    today = clock.today()
    return general_expenses.general_expenses(db, month or f"{today.year:04d}-{today.month:02d}")


# --- Ortak hesapları ---


@router.get("/partners", response_model=list[PartnerBalance])
def partner_balances(db: DbSession, _: Viewer) -> list[PartnerBalance]:
    return reports.partner_balances(db)


@router.get("/partners/{partner_id}/statement", response_model=list[StatementLine])
def partner_statement(partner_id: int, db: DbSession, _: Viewer) -> list[StatementLine]:
    return reports.partner_statement(db, get_partner(db, partner_id))


@router.get("/partner-transactions", response_model=list[PartnerTxRead])
def list_partner_transactions(
    db: DbSession, _: Viewer, partner_id: int | None = None
) -> list[PartnerTxRead]:
    query = select(PartnerTransaction).order_by(
        PartnerTransaction.tx_date.desc(), PartnerTransaction.id.desc()
    )
    if partner_id is not None:
        query = query.where(PartnerTransaction.partner_id == partner_id)
    return [reports.partner_tx_read(tx) for tx in db.scalars(query.limit(200))]


@router.post(
    "/partner-transactions", response_model=PartnerTxRead, status_code=status.HTTP_201_CREATED
)
def create_partner_transaction(
    data: PartnerTxCreate, db: DbSession, actor: Recorder, context: Context
) -> PartnerTxRead:
    tx = partners.create_transaction(db, **data.model_dump(), actor=actor, context=context)
    return reports.partner_tx_read(tx)


@router.post("/partner-transactions/{tx_id}/cancel", response_model=PartnerTxRead)
def cancel_partner_transaction(
    tx_id: int, data: CancelRequest, db: DbSession, actor: Recorder, context: Context
) -> PartnerTxRead:
    tx = partners.cancel_transaction(
        db, partners.get_transaction(db, tx_id), data.reason, actor=actor, context=context
    )
    return reports.partner_tx_read(tx)


# --- Ödeme planı ---


def _plan(db: DbSession, plan_id: int) -> PaymentPlan:
    plan = db.get(PaymentPlan, plan_id)
    if plan is None:
        raise NotFoundError("Ödeme planı satırı bulunamadı.")
    return plan


def _plannable_event(db: DbSession, event_id: int) -> Event:
    event = get_event(db, event_id)
    if event.status == EventStatus.CANCELLED:
        raise DomainError("İptal edilmiş etkinliğin ödeme planı değiştirilemez.")
    return event


@router.post(
    "/events/{event_id}/payment-plans", response_model=list[PaymentPlanRead], status_code=201
)
def add_plan(
    event_id: int, data: PaymentPlanCreate, db: DbSession, actor: Recorder, context: Context
) -> list[PaymentPlanRead]:
    event = _plannable_event(db, event_id)
    db.add(PaymentPlan(event_id=event.id, **data.model_dump(), sort_order=99))
    audit.record(
        db,
        actor=actor,
        action="payment_plan.create",
        entity_type="event",
        entity_id=event.id,
        summary=f"{event.event_no} ödeme planına eklendi: {data.title} {data.amount}.",
        context=context,
    )
    db.commit()
    return reports.plan_reads(db, event)


@router.patch("/payment-plans/{plan_id}", response_model=list[PaymentPlanRead])
def update_plan(
    plan_id: int, data: PaymentPlanUpdate, db: DbSession, actor: Recorder, context: Context
) -> list[PaymentPlanRead]:
    plan = _plan(db, plan_id)
    event = _plannable_event(db, plan.event_id)
    changes = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    diff = audit.apply_changes(plan, changes, ["title", "due_date", "amount"])
    audit.record(
        db,
        actor=actor,
        action="payment_plan.update",
        entity_type="event",
        entity_id=event.id,
        summary=f"{event.event_no} ödeme planı güncellendi: {plan.title}.",
        changes=diff,
        context=context,
    )
    db.commit()
    return reports.plan_reads(db, event)


@router.delete("/payment-plans/{plan_id}", response_model=list[PaymentPlanRead])
def delete_plan(
    plan_id: int, db: DbSession, actor: Recorder, context: Context
) -> list[PaymentPlanRead]:
    plan = _plan(db, plan_id)
    event = _plannable_event(db, plan.event_id)
    audit.record(
        db,
        actor=actor,
        action="payment_plan.delete",
        entity_type="event",
        entity_id=event.id,
        summary=f"{event.event_no} ödeme planından silindi: {plan.title}.",
        context=context,
    )
    db.delete(plan)
    db.commit()
    return reports.plan_reads(db, event)
