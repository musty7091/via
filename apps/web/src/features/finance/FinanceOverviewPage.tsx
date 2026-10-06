import { AlertTriangle, Banknote, CreditCard, HandCoins, Landmark, Users, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { useOverview, type FinanceOverview } from "@/features/finance/api";
import { PartnerBalancesCard } from "@/features/finance/PartnerBalancesCard";
import { RatesStrip } from "@/features/rates/Rates";
import { formatDate, type Currency } from "@/shared/lib/format";
import {
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  StatCard,
  type Column,
} from "@/shared/ui";

type OpenReceivable = {
  event_id: number;
  event_no: string;
  title: string;
  customer: string;
  event_date: string;
  currency: Currency;
  remaining_amount: string;
  remaining_base: string;
};

const receivableColumns: Column<OpenReceivable>[] = [
  {
    key: "event",
    header: "Etkinlik",
    cell: (r) => (
      <div>
        <p className="font-medium text-ink">{r.title}</p>
        <p className="text-xs text-ink-muted">
          {r.event_no} · {r.customer}
        </p>
      </div>
    ),
  },
  { key: "date", header: "Tarih", cell: (r) => formatDate(r.event_date, "short") },
  {
    key: "remaining",
    header: "Kalan alacak",
    align: "right",
    cell: (r) => <Money amount={r.remaining_amount} currency={r.currency} baseAmount={r.remaining_base} />,
  },
];

function Alerts({ data }: { data: FinanceOverview }) {
  const items = [
    data.totals.overdue_plans > 0 && `${data.totals.overdue_plans} müşteri ödemesi vadesini geçti.`,
    data.totals.overdue_payables > 0 && `${data.totals.overdue_payables} sanatçı/tedarikçi borcunun vadesi geçti.`,
    Number(data.totals.partner_held_base) > 0 && "Ortaklar üzerinde şirkete teslim edilmemiş para var.",
  ].filter(Boolean) as string[];
  if (items.length === 0) return null;
  return (
    <ul className="mb-6 space-y-1.5 rounded-lg border border-warning-50 bg-warning-50 px-4 py-3 text-sm text-warning-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {item}
        </li>
      ))}
    </ul>
  );
}

export function FinanceOverviewPage() {
  const overview = useOverview();
  const navigate = useNavigate();
  if (overview.isPending) return <LoadingState />;
  if (overview.isError) return <ErrorState error={overview.error} />;
  const data = overview.data;
  const t = data.totals;

  return (
    <>
      <RatesStrip />
      <Alerts data={data} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Kasa + Banka (TL karşılığı)" value={<Money amount={t.cash_base} />} icon={Wallet} onClick={() => navigate("/finans/kasa")} />
        <StatCard label="Müşterilerden alacak" value={<Money amount={t.receivables_base} />} icon={Banknote} tone="warning" />
        <StatCard
          label="Sanatçı / tedarikçi borcu"
          value={<Money amount={t.payables_base} />}
          icon={CreditCard}
          tone="danger"
          onClick={() => navigate("/finans/borclar")}
        />
        <StatCard
          label="Ortaklar üzerindeki para"
          value={<Money amount={t.partner_held_base} />}
          hint={Number(t.owed_to_partners_base) > 0 ? <>Şirketin ortaklara borcu: <Money amount={t.owed_to_partners_base} /></> : undefined}
          icon={Users}
          tone="warning"
          onClick={() => navigate("/ortaklar")}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Açık Müşteri Alacakları" description="Tahsilatı tamamlanmamış etkinlikler" />
          <DataTable
            columns={receivableColumns}
            rows={data.open_receivables as OpenReceivable[]}
            rowKey={(r) => r.event_id}
            onRowClick={(r) => navigate(`/etkinlikler/${r.event_id}?sekme=odemeler`)}
            empty={<EmptyState icon={HandCoins} title="Açık alacak yok" />}
          />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Kasa ve Banka" actions={<Link to="/finans/kasa" className="text-sm text-brand-700 hover:underline">Hareketler</Link>} />
            <ul className="divide-y divide-line">
              {data.cash_accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  {a.account_type === "bank" ? <Landmark className="size-4 text-ink-muted" aria-hidden /> : <Wallet className="size-4 text-ink-muted" aria-hidden />}
                  <span className="flex-1 text-sm">{a.name}</span>
                  <Money amount={a.balance} currency={a.currency} className="text-sm font-medium" />
                </li>
              ))}
              {data.cash_accounts.length === 0 && <li className="px-5 py-4 text-sm text-ink-muted">Henüz hesap tanımlanmadı.</li>}
            </ul>
          </Card>
          <PartnerBalancesCard balances={data.partners} />
          {Number(t.vat_payable_base) > 0 && (
            <Card className="px-5 py-4 text-sm">
              <p className="text-ink-muted">Faturalı işlerden doğan KDV</p>
              <p className="mt-1 text-lg font-medium">
                <Money amount={t.vat_payable_base} />
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
