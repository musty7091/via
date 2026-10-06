import { Landmark, Plus, Wallet } from "lucide-react";
import { useState } from "react";

import { useCan } from "@/features/auth/auth";
import {
  useCashAccounts,
  useCollections,
  useCreateCashAccount,
  useExpenses,
  useMovements,
  usePayables,
} from "@/features/finance/api";
import { CollectionsTable, ExpensesTable, PayablesTable } from "@/features/finance/FinanceTables";
import { formatDate, todayISO, type Currency } from "@/shared/lib/format";
import { ENTRY_KIND_LABELS, expenseCategoryOptions } from "@/shared/lib/labels";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CurrencySelect,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  Input,
  LoadingState,
  Money,
  Select,
  Toolbar,
  toast,
  type Column,
} from "@/shared/ui";

// --- Tahsilatlar ---

export function CollectionsPage() {
  const [status, setStatus] = useState("active");
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [year, mon] = month.split("-").map(Number);
  const dateTo = new Date(year, mon, 0).getDate();
  const collections = useCollections({
    status: status || undefined,
    date_from: month ? `${month}-01` : undefined,
    date_to: month ? `${month}-${String(dateTo).padStart(2, "0")}` : undefined,
    limit: 200,
  });
  const rows = collections.data?.items ?? [];
  const totals = rows
    .filter((c) => c.status === "active")
    .reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.currency]: (acc[c.currency] ?? 0) + Number(c.amount) }), {});

  return (
    <Card>
      <Toolbar>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="sm:w-44" aria-label="Ay" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-40" aria-label="Durum">
          <option value="active">Aktif</option>
          <option value="cancelled">İptal edilenler</option>
          <option value="">Tümü</option>
        </Select>
        <div className="flex flex-wrap gap-3 text-sm sm:ml-auto">
          {Object.entries(totals).map(([currency, total]) => (
            <span key={currency}>
              Toplam: <Money amount={total} currency={currency as Currency} className="font-semibold" />
            </span>
          ))}
        </div>
      </Toolbar>
      {collections.isError ? <ErrorState error={collections.error} /> : <CollectionsTable rows={rows} loading={collections.isPending} />}
    </Card>
  );
}

// --- Borçlar ---

export function PayablesPage() {
  const [state, setState] = useState("open");
  const payables = usePayables({ state, limit: 200 });
  const rows = payables.data?.items ?? [];
  const totalBase = rows.reduce((sum, p) => sum + Number(p.remaining_base), 0);
  return (
    <Card>
      <Toolbar>
        <Select value={state} onChange={(e) => setState(e.target.value)} className="sm:w-48" aria-label="Durum">
          <option value="open">Ödenecekler</option>
          <option value="paid">Ödenenler</option>
          <option value="all">Tümü</option>
        </Select>
        {state === "open" && (
          <span className="text-sm sm:ml-auto">
            Toplam kalan borç: <Money amount={totalBase} className="font-semibold" />
          </span>
        )}
      </Toolbar>
      {payables.isError ? <ErrorState error={payables.error} /> : <PayablesTable rows={rows} loading={payables.isPending} />}
    </Card>
  );
}

// --- Giderler ---

export function ExpensesPage() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [category, setCategory] = useState("");
  const expenses = useExpenses({ month: month || undefined, category: category || undefined, limit: 200 });
  const rows = expenses.data?.items ?? [];
  const totalBase = rows.reduce((sum, e) => sum + Number(e.base_amount), 0);
  return (
    <Card>
      <Toolbar>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="sm:w-44" aria-label="Ay" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-48" aria-label="Kategori">
          <option value="">Tüm kategoriler</option>
          {expenseCategoryOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <span className="text-sm sm:ml-auto">
          Toplam: <Money amount={totalBase} className="font-semibold" />
        </span>
      </Toolbar>
      {expenses.isError ? <ErrorState error={expenses.error} /> : <ExpensesTable rows={rows} loading={expenses.isPending} />}
    </Card>
  );
}

// --- Kasa ve banka ---

type MovementRow = NonNullable<ReturnType<typeof useMovements>["data"]>[number];

function NewAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateCashAccount();
  const [name, setName] = useState("");
  const [type, setType] = useState<"cash" | "bank">("cash");
  const [currency, setCurrency] = useState("TRY");
  const [iban, setIban] = useState("");
  const close = (next: boolean) => {
    if (!next) {
      setName("");
      setIban("");
      create.reset();
    }
    onOpenChange(next);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Yeni Kasa / Banka Hesabı"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button
            loading={create.isPending}
            disabled={name.trim().length < 2}
            onClick={() =>
              create.mutate(
                { name: name.trim(), account_type: type, currency, iban: iban.trim() || null },
                {
                  onSuccess: () => {
                    toast.success("Hesap açıldı.");
                    close(false);
                  },
                },
              )
            }
          >
            Hesabı Aç
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Hesap adı" required>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ör. Garanti TL" />}
        </Field>
        <Field label="Tür">
          {(p) => (
            <Select {...p} value={type} onChange={(e) => setType(e.target.value as "cash" | "bank")}>
              <option value="cash">Kasa (nakit)</option>
              <option value="bank">Banka</option>
            </Select>
          )}
        </Field>
        <Field label="Para birimi" hint="Hesap açıldıktan sonra değiştirilemez">
          {(p) => <CurrencySelect {...p} value={currency} onChange={(e) => setCurrency(e.target.value)} />}
        </Field>
        {type === "bank" && <Field label="IBAN">{(p) => <Input {...p} value={iban} onChange={(e) => setIban(e.target.value)} />}</Field>}
        <FormError error={create.error} />
      </div>
    </Dialog>
  );
}

export function CashPage() {
  const can = useCan();
  const accounts = useCashAccounts();
  const [selected, setSelected] = useState(0);
  const [creating, setCreating] = useState(false);
  const list = accounts.data ?? [];
  const current = list.find((a) => a.id === selected) ?? list[0];
  const movements = useMovements(current?.id ?? 0);

  const columns: Column<MovementRow>[] = [
    {
      key: "desc",
      header: "Açıklama",
      cell: (m) => (
        <div className={m.is_reversal ? "text-ink-muted" : ""}>
          <p className="text-ink">{m.description}</p>
          <p className="text-xs text-ink-muted">
            {m.entry_no} · {ENTRY_KIND_LABELS[m.kind] ?? m.kind}
          </p>
        </div>
      ),
    },
    { key: "date", header: "Tarih", cell: (m) => formatDate(m.entry_date, "short") },
    {
      key: "amount",
      header: "Giriş / Çıkış",
      align: "right",
      cell: (m) => <Money amount={m.amount} currency={m.currency} signed />,
    },
    { key: "running", header: "Bakiye", align: "right", cell: (m) => <Money amount={m.running_amount} currency={m.currency} /> },
  ];

  if (accounts.isPending) return <LoadingState />;
  if (accounts.isError) return <ErrorState error={accounts.error} />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader
          title="Hesaplar"
          actions={
            can("settings.manage") && (
              <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
                <Plus /> Hesap
              </Button>
            )
          }
        />
        {list.length === 0 ? (
          <EmptyState icon={Wallet} title="Henüz kasa veya banka hesabı yok" />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSelected(a.id)}
                  className={`flex w-full items-center gap-3 px-5 py-3 text-left ${current?.id === a.id ? "bg-brand-50" : "hover:bg-surface-muted"}`}
                >
                  {a.account_type === "bank" ? <Landmark className="size-4 text-ink-muted" aria-hidden /> : <Wallet className="size-4 text-ink-muted" aria-hidden />}
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{a.name}</span>
                    {a.iban && <span className="block font-mono text-xs text-ink-muted">{a.iban}</span>}
                  </span>
                  <Money amount={a.balance} currency={a.currency} className="text-sm font-medium" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader
          title={current ? `${current.name} hareketleri` : "Hareketler"}
          description="Her satır muhasebe fişine bağlıdır; iptaller ters kayıt olarak görünür."
          actions={current && <Badge tone="brand" dot={false}>{current.currency}</Badge>}
        />
        <DataTable
          columns={columns}
          rows={[...(movements.data ?? [])].reverse()}
          rowKey={(m) => `${m.entry_id}-${m.amount}`}
          empty={movements.isPending && current ? <LoadingState /> : <EmptyState icon={Wallet} title="Hareket yok" />}
        />
      </Card>
      <NewAccountDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
