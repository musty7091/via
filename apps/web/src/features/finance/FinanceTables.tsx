import { Ban, ChevronDown, CreditCard, Pencil, Receipt, Wallet } from "lucide-react";
import { Fragment, useState } from "react";
import { Link } from "react-router";

import { useCan } from "@/features/auth/auth";
import {
  useCancelCollection,
  useCancelExpense,
  useCancelPayable,
  useCancelPayment,
  type Collection,
  type Expense,
  type Payable,
} from "@/features/finance/api";
import { PaymentDialog } from "@/features/finance/PaymentDialog";
import { formatDate, type Currency } from "@/shared/lib/format";
import { EXPENSE_CATEGORY_LABELS, PAYABLE_STATE, PAYMENT_METHOD_LABELS } from "@/shared/lib/labels";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  LoadingState,
  Money,
  ReasonDialog,
  toast,
  type Column,
} from "@/shared/ui";

type CancelTarget = { kind: "collection" | "expense" | "payable" | "payment"; id: number; label: string };

/** İptal pencereleri tek yerden yönetilir. */
function useCancelFlow() {
  const [target, setTarget] = useState<CancelTarget | null>(null);
  const mutations = {
    collection: useCancelCollection(),
    expense: useCancelExpense(),
    payable: useCancelPayable(),
    payment: useCancelPayment(),
  };
  const active = target ? mutations[target.kind] : null;
  const dialog = (
    <ReasonDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) {
          active?.reset();
          setTarget(null);
        }
      }}
      title="Kayıt İptal Edilecek"
      description={target?.label ?? ""}
      confirmLabel="İptal Et"
      loading={active?.isPending}
      error={active?.error}
      onConfirm={(reason) =>
        target &&
        active?.mutate(
          { id: target.id, reason },
          {
            onSuccess: () => {
              toast.success("Kayıt iptal edildi.");
              setTarget(null);
            },
          },
        )
      }
    />
  );
  return { cancel: setTarget, dialog };
}

// --- Tahsilatlar ---

export function CollectionsTable({ rows, loading, showEvent = true }: { rows: Collection[]; loading?: boolean; showEvent?: boolean }) {
  const can = useCan();
  const { cancel, dialog } = useCancelFlow();
  const columns: Column<Collection>[] = [
    {
      key: "main",
      header: "Tahsilat",
      cell: (c) => (
        <div className={c.status === "cancelled" ? "opacity-60" : ""}>
          <p className="font-medium text-ink">
            {c.customer.name}
            {c.status === "cancelled" && (
              <Badge tone="neutral" className="ml-2">
                İptal
              </Badge>
            )}
          </p>
          <p className="text-xs text-ink-muted">
            {c.collection_no}
            {showEvent && (
              <>
                {" · "}
                <Link to={`/etkinlikler/${c.event.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                  {c.event.name}
                </Link>
              </>
            )}
          </p>
        </div>
      ),
    },
    { key: "date", header: "Tarih", cell: (c) => formatDate(c.collection_date, "short") },
    {
      key: "dest",
      header: "Nereye",
      cell: (c) => (c.partner_id ? <Badge tone="warning">{c.destination}</Badge> : c.destination),
    },
    { key: "method", header: "Şekil", hideOnMobile: true, cell: (c) => PAYMENT_METHOD_LABELS[c.method] },
    {
      key: "amount",
      header: "Tutar",
      align: "right",
      cell: (c) => (
        <span className={c.status === "cancelled" ? "line-through opacity-60" : ""}>
          <Money amount={c.amount} currency={c.currency} />
          {c.currency !== c.event_currency && (
            <span className="block text-xs text-ink-muted">
              karşılığı <Money amount={c.applied_amount} currency={c.event_currency} />
            </span>
          )}
        </span>
      ),
    },
    ...(can("finance.record")
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            interactive: true,
            cell: (c: Collection) =>
              c.status === "active" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancel({ kind: "collection", id: c.id, label: `${c.collection_no} tahsilatı iptal edilecek.` })}
                  aria-label="Tahsilatı iptal et"
                >
                  <Ban />
                </Button>
              ),
          },
        ]
      : []),
  ];
  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        empty={loading ? <LoadingState /> : <EmptyState icon={Wallet} title="Tahsilat yok" />}
      />
      {dialog}
    </>
  );
}

// --- Borçlar ---

export function PayablesTable({
  rows,
  loading,
  showEvent = true,
  onEdit,
}: {
  rows: Payable[];
  loading?: boolean;
  showEvent?: boolean;
  onEdit?: (p: Payable) => void;
}) {
  const can = useCan();
  const canRecord = can("finance.record");
  const [paying, setPaying] = useState<Payable | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { cancel, dialog } = useCancelFlow();

  if (rows.length === 0) return loading ? <LoadingState /> : <EmptyState icon={CreditCard} title="Borç yok" />;

  return (
    <>
      <ul className="divide-y divide-line">
        {rows.map((p) => {
          const state = PAYABLE_STATE[p.state];
          const active = p.status === "active";
          const open = expanded === p.id;
          return (
            <Fragment key={p.id}>
              <li className={`flex flex-wrap items-start gap-3 px-4 py-3 sm:px-5 ${active ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {p.payee?.name ?? <span className="text-warning-700">Ödenecek kişi belirtilmemiş</span>}
                    <Badge tone={state.tone}>{state.label}</Badge>
                    {p.is_overdue && <Badge tone="danger">Vadesi geçti</Badge>}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {p.title}
                    {showEvent && p.event && (
                      <>
                        {" · "}
                        <Link to={`/etkinlikler/${p.event.id}`} className="hover:underline">
                          {p.event.name}
                        </Link>
                      </>
                    )}
                    {p.due_date && ` · vade ${formatDate(p.due_date, "short")}`}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <Money amount={p.remaining_amount} currency={p.currency as Currency} className="font-medium" />
                  <p className="text-xs text-ink-muted">
                    kalan / <Money amount={p.amount} currency={p.currency as Currency} />
                  </p>
                </div>
                <div className="flex w-full justify-end gap-1 sm:w-auto">
                  {p.payments.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setExpanded(open ? null : p.id)} aria-expanded={open}>
                      {p.payments.length} ödeme <ChevronDown className={open ? "rotate-180" : ""} />
                    </Button>
                  )}
                  {canRecord && active && p.state !== "paid" && (
                    <Button size="sm" onClick={() => setPaying(p)}>
                      <CreditCard /> Öde
                    </Button>
                  )}
                  {canRecord && active && onEdit && !p.from_expense && (
                    <Button variant="ghost" size="icon" onClick={() => onEdit(p)} aria-label="Borcu düzenle">
                      <Pencil />
                    </Button>
                  )}
                  {canRecord && active && !p.from_expense && Number(p.paid_amount) === 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => cancel({ kind: "payable", id: p.id, label: `"${p.title}" borcu iptal edilecek; maliyet etkinlikten düşer.` })}
                      aria-label="Borcu iptal et"
                    >
                      <Ban />
                    </Button>
                  )}
                </div>
              </li>
              {open && (
                <li className="bg-surface-muted px-4 py-2 sm:px-8">
                  <ul className="divide-y divide-line text-sm">
                    {p.payments.map((pay) => (
                      <li key={pay.id} className={`flex items-center gap-3 py-2 ${pay.status === "cancelled" ? "opacity-60" : ""}`}>
                        <span className="w-24 text-ink-muted">{formatDate(pay.payment_date, "short")}</span>
                        <span className="flex-1">
                          {pay.source}
                          {pay.status === "cancelled" && <Badge className="ml-2">İptal</Badge>}
                        </span>
                        <Money amount={pay.amount} currency={pay.currency} />
                        {canRecord && pay.status === "active" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => cancel({ kind: "payment", id: pay.id, label: `${pay.payment_no} ödemesi iptal edilecek; para kaynağına geri döner.` })}
                            aria-label="Ödemeyi iptal et"
                          >
                            <Ban />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </Fragment>
          );
        })}
      </ul>
      <PaymentDialog payable={paying} onClose={() => setPaying(null)} />
      {dialog}
    </>
  );
}

// --- Giderler ---

export function ExpensesTable({ rows, loading, showEvent = true }: { rows: Expense[]; loading?: boolean; showEvent?: boolean }) {
  const can = useCan();
  const { cancel, dialog } = useCancelFlow();
  const columns: Column<Expense>[] = [
    {
      key: "title",
      header: "Gider",
      cell: (e) => (
        <div className={e.status === "cancelled" ? "opacity-60" : ""}>
          <p className="font-medium text-ink">
            {e.title}
            {e.status === "cancelled" && <Badge className="ml-2">İptal</Badge>}
          </p>
          <p className="text-xs text-ink-muted">
            {EXPENSE_CATEGORY_LABELS[e.category]}
            {showEvent && (e.event ? ` · ${e.event.name}` : " · Genel gider")}
          </p>
        </div>
      ),
    },
    { key: "date", header: "Tarih", cell: (e) => formatDate(e.expense_date, "short") },
    {
      key: "paid",
      header: "Ödeme",
      cell: (e) => (e.paid_by === "unpaid" ? <Badge tone="warning">{e.paid_from}</Badge> : e.paid_from),
    },
    {
      key: "amount",
      header: "Tutar",
      align: "right",
      cell: (e) => <Money amount={e.amount} currency={e.currency} baseAmount={e.base_amount} />,
    },
    ...(can("finance.record")
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            interactive: true,
            cell: (e: Expense) =>
              e.status === "active" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancel({ kind: "expense", id: e.id, label: `${e.expense_no} gideri iptal edilecek.` })}
                  aria-label="Gideri iptal et"
                >
                  <Ban />
                </Button>
              ),
          },
        ]
      : []),
  ];
  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        empty={loading ? <LoadingState /> : <EmptyState icon={Receipt} title="Gider yok" />}
      />
      {dialog}
    </>
  );
}

