import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Lock, Receipt } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { useCan } from "@/features/auth/auth";
import { ExpenseDialog } from "@/features/finance/ExpenseDialog";
import { api, type Schema } from "@/shared/api/client";
import { cn } from "@/shared/lib/cn";
import { formatDate, formatMoney, formatPeriod, todayISO, type Currency } from "@/shared/lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/shared/lib/labels";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
  ProgressBar,
  StatCard,
  type Column,
} from "@/shared/ui";

type GeneralExpenses = Schema<"GeneralExpenses">;
type Direct = GeneralExpenses["direct"][number];
type Spread = GeneralExpenses["spread"][number];

const ALLOCATION = { month: "Bu döneme ait", season: "Tüm sezona ait", rest_of_season: "Bu aydan sezon sonuna" } as const;

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function useGeneralExpenses(month: string) {
  return useQuery({
    queryKey: ["finance", "general-expenses", month],
    queryFn: () => api<GeneralExpenses>("/finance/general-expenses", { query: { month } }),
  });
}

const directColumns: Column<Direct>[] = [
  { key: "date", header: "Tarih", cell: (d) => formatDate(d.expense_date, "short") },
  {
    key: "title",
    header: "Gider",
    cell: (d) => (
      <div>
        <p className="font-medium text-ink">{d.title}</p>
        <p className="text-xs text-ink-muted">
          {d.expense_no} · {EXPENSE_CATEGORY_LABELS[d.category]}
        </p>
      </div>
    ),
  },
  {
    key: "paid",
    header: "Ödeme",
    cell: (d) => (
      <span className={cn("text-sm", d.paid_by === "unpaid" && "text-warning-700")}>
        {d.paid_by_label}
        {d.payer && <span className="block text-xs text-ink-muted">{d.payer}</span>}
      </span>
    ),
    hideOnMobile: true,
  },
  {
    key: "amount",
    header: "Tutar",
    align: "right",
    cell: (d) => <Money amount={d.amount} currency={d.currency as Currency} baseAmount={d.base} className="font-medium" />,
  },
];

function SpreadRow({ s }: { s: Spread }) {
  const done = Number(s.recognized_to_date);
  const total = Number(s.total_base);
  return (
    <li className="space-y-2 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{s.title}</p>
          <p className="text-xs text-ink-muted">
            {s.expense_no} · {EXPENSE_CATEGORY_LABELS[s.category]} · {formatDate(s.expense_date, "short")} tarihinde girildi
          </p>
        </div>
        <Badge tone={s.allocation === "season" ? "brand" : "info"} dot={false}>
          {ALLOCATION[s.allocation]}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-5">
        <div>
          <dt className="text-xs text-ink-muted">Dönem</dt>
          <dd>
            {formatPeriod(s.spread_from)} – {formatPeriod(s.spread_until)} ({s.months} ay)
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Toplam</dt>
          <dd className="tabular">{formatMoney(s.total_base)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Aylık pay</dt>
          <dd className="tabular">{formatMoney(s.monthly_share)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Bu aya yazılan</dt>
          <dd className="font-semibold tabular">{formatMoney(s.this_month)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Kalan</dt>
          <dd className="tabular">{formatMoney(s.remaining)}</dd>
        </div>
      </dl>
      <ProgressBar value={done} max={total} label={`${s.title} yazılan pay`} />
      {Number(s.this_month) > Number(s.monthly_share) + 0.01 && (
        <p className="text-xs text-ink-muted">Bu aya yazılan tutar, sezonun geçmiş aylarının payını da içerir.</p>
      )}
    </li>
  );
}

export function GeneralExpensesPage() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(params.get("ay") ?? "") ? (params.get("ay") as string) : todayISO().slice(0, 7);
  const setMonth = (m: string) => setParams({ ay: m }, { replace: true });
  const query = useGeneralExpenses(month);
  const [dialog, setDialog] = useState(false);
  const g = query.data;
  const maxSeason = Math.max(1, ...(g?.season.map((m) => Number(m.total)) ?? [1]));
  const maxCategory = Math.max(1, ...(g?.categories.map((c) => Number(c.total)) ?? [1]));

  return (
    <>
      <PageHeader
        eyebrow="Finans"
        title="Genel Giderler"
        description="Etkinliğe bağlı olmayan şirket giderleri. Dönem kapanışında ortaklara eşit yansıtılır."
        actions={
          can("finance.record") && (
            <Button onClick={() => setDialog(true)}>
              <Receipt /> Gider Gir
            </Button>
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="icon" aria-label="Önceki ay" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft />
        </Button>
        <p className="min-w-36 text-center font-display text-lg text-ink">{formatPeriod(month)}</p>
        <Button variant="secondary" size="icon" aria-label="Sonraki ay" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight />
        </Button>
        {g?.closed && (
          <Badge tone="success">
            <Lock className="size-3" aria-hidden /> Dönem kapalı
          </Badge>
        )}
        {g && <span className="ml-auto text-sm text-ink-muted">Sezon: {g.season_label}</span>}
      </div>

      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : (
        g && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Bu ayın genel gideri" value={<Money amount={g.month_total} />} hint="Ortaklara yansıyacak tutar" tone="danger" />
              <StatCard label="Bu döneme ait giderler" value={<Money amount={g.direct_total} />} hint={`${g.direct.length} kalem`} />
              <StatCard label="Aylara bölünenlerin payı" value={<Money amount={g.spread_total} />} hint={`${g.spread.length} gider`} />
              <StatCard label="Sezon toplamı" value={<Money amount={g.season_total} />} hint={g.season_label} />
            </div>

            <Card>
              <CardHeader title="Bu Döneme Ait Giderler" description={`${formatPeriod(month)} içinde girilen, sadece bu aya ait giderler.`} />
              <DataTable
                columns={directColumns}
                rows={g.direct}
                rowKey={(d) => d.id}
                empty={<EmptyState icon={Receipt} title="Bu ay genel gider yok" />}
              />
            </Card>

            <Card>
              <CardHeader
                title="Aylara Bölünen Giderler"
                description="Tüm sezona veya sezon sonuna kadar bölünen giderler; her aya düşen pay ve kalan."
              />
              {g.spread.length === 0 ? (
                <EmptyState icon={Receipt} title="Bu aya düşen bölünmüş gider yok" />
              ) : (
                <ul className="divide-y divide-line">
                  {g.spread.map((s) => (
                    <SpreadRow key={s.id} s={s} />
                  ))}
                </ul>
              )}
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="Sezon Boyunca" description="Her ayın genel gideri (doğrudan + bölünen paylar)." />
                <ul className="space-y-1 px-5 py-4">
                  {g.season.map((m) => (
                    <li key={m.month}>
                      <button
                        type="button"
                        onClick={() => setMonth(m.month)}
                        className={cn(
                          "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas",
                          m.month === month && "bg-brand-50",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2">
                            {m.label}
                            {m.closed && <Lock className="size-3 text-ink-muted" aria-label="kapalı" />}
                          </span>
                          <span className="tabular">{formatMoney(m.total)}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-canvas">
                          <div className="h-full rounded-full bg-accent-500" style={{ width: `${(Number(m.total) / maxSeason) * 100}%` }} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardHeader title="Kategori Dağılımı" description={`${formatPeriod(month)} genel giderleri`} />
                {g.categories.length === 0 ? (
                  <EmptyState icon={Receipt} title="Gider yok" />
                ) : (
                  <ul className="space-y-3 px-5 py-4 text-sm">
                    {g.categories.map((c) => (
                      <li key={c.category}>
                        <div className="flex justify-between gap-3">
                          <span>{EXPENSE_CATEGORY_LABELS[c.category]}</span>
                          <span className="tabular">{formatMoney(c.total)}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-canvas">
                          <div className="h-full rounded-full bg-brand-700" style={{ width: `${(Number(c.total) / maxCategory) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )
      )}
      <ExpenseDialog open={dialog} onOpenChange={setDialog} />
    </>
  );
}
