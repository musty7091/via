import { AlertTriangle, ArrowDownToLine, Banknote, CalendarDays, CreditCard, FileText, Receipt, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { useCan, useCurrentUser } from "@/features/auth/auth";
import { useEvents } from "@/features/events/api";
import { eventColumns } from "@/features/events/eventColumns";
import { useOverview } from "@/features/finance/api";
import { MyTasksCard } from "@/features/operations/MyTasksCard";
import { useMonthlyReport } from "@/features/reports/api";
import { MonthlyChart } from "@/features/reports/MonthlyChart";
import { CollectionDialog } from "@/features/finance/CollectionDialog";
import { ExpenseDialog } from "@/features/finance/ExpenseDialog";
import { todayISO } from "@/shared/lib/format";
import { Button, Card, CardHeader, DataTable, EmptyState, LoadingState, Money, PageHeader, StatCard } from "@/shared/ui";

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("tr-TR", { hour: "numeric", timeZone: "Europe/Istanbul" }).format(new Date()));
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

function FinanceSummary() {
  const overview = useOverview();
  const navigate = useNavigate();
  if (overview.isPending) return <LoadingState />;
  if (!overview.data) return null;
  const t = overview.data.totals;
  const alerts = [
    t.overdue_plans > 0 && `${t.overdue_plans} müşteri ödemesinin vadesi geçti.`,
    t.overdue_payables > 0 && `${t.overdue_payables} sanatçı/tedarikçi borcunun vadesi geçti.`,
    Number(t.partner_held_base) > 0 && "Ortaklar üzerinde şirkete teslim edilmemiş para var.",
  ].filter(Boolean) as string[];
  return (
    <>
      {alerts.length > 0 && (
        <ul className="mb-6 space-y-1.5 rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700">
          {alerts.map((a) => (
            <li key={a} className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {a}
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Kasa + Banka" value={<Money amount={t.cash_base} />} icon={Wallet} onClick={() => navigate("/finans/kasa")} />
        <StatCard label="Müşterilerden alacak" value={<Money amount={t.receivables_base} />} icon={Banknote} tone="warning" onClick={() => navigate("/finans")} />
        <StatCard label="Sanatçı / tedarikçi borcu" value={<Money amount={t.payables_base} />} icon={CreditCard} tone="danger" onClick={() => navigate("/finans/borclar")} />
        <StatCard label="Ortaklar üzerindeki para" value={<Money amount={t.partner_held_base} />} icon={Users} tone="warning" onClick={() => navigate("/ortaklar")} />
      </div>
    </>
  );
}

/** Son 6 ayın gelir ve net sonucu; bu ayın rakamları üstte. */
function MonthlyTrend() {
  const report = useMonthlyReport(undefined, undefined);
  if (report.isPending) return <LoadingState />;
  if (!report.data) return null;
  const rows = report.data.rows.slice(-6);
  const current = rows[rows.length - 1];
  return (
    <Card className="mt-6">
      <CardHeader
        title="Son 6 Ay"
        description={`${current.label}: ${current.event_count} etkinlik`}
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/raporlar?sekme=aylik">Raporlar</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 px-5 py-5 lg:grid-cols-[1fr_16rem]">
        <MonthlyChart rows={rows} />
        <dl className="grid grid-cols-2 gap-4 self-start text-sm lg:grid-cols-1">
          <div>
            <dt className="text-ink-muted">Bu ay gelir</dt>
            <dd className="font-display text-xl text-ink">
              <Money amount={current.revenue} />
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Bu ay net sonuç</dt>
            <dd className="font-display text-xl">
              <Money amount={current.net} signed />
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Bu ay tahsilat</dt>
            <dd className="font-display text-xl text-ink">
              <Money amount={current.collections} />
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const user = useCurrentUser();
  const can = useCan();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<"collection" | "expense" | null>(null);
  const upcoming = useEvents({ search: "", status: "planned", period: "upcoming", offset: 0 }, todayISO(), can("events.view"));
  const firstName = user.full_name.split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow="Genel Bakış"
        title={`${greeting()}, ${firstName}`}
        description="Şirketin bugünkü durumu ve yaklaşan işler."
        actions={
          <>
            {can("finance.record") && (
              <>
                <Button onClick={() => setDialog("collection")}>
                  <ArrowDownToLine /> Tahsilat Gir
                </Button>
                <Button variant="secondary" onClick={() => setDialog("expense")}>
                  <Receipt /> Gider Gir
                </Button>
              </>
            )}
            {can("offers.manage") && (
              <Button variant="secondary" asChild>
                <Link to="/teklifler">
                  <FileText /> Teklifler
                </Link>
              </Button>
            )}
          </>
        }
      />

      <MyTasksCard className="mb-6" />

      {can("finance.view") && <FinanceSummary />}
      {can("reports.view") && <MonthlyTrend />}

      {can("events.view") && (
        <Card className="mt-6">
          <CardHeader
            title="Yaklaşan Etkinlikler"
            actions={
              <Button variant="secondary" size="sm" asChild>
                <Link to="/etkinlikler">Tümü</Link>
              </Button>
            }
          />
          <DataTable
            columns={eventColumns(can("finance.view"))}
            rows={(upcoming.data?.items ?? []).slice(0, 8)}
            rowKey={(e) => e.id}
            onRowClick={(e) => navigate(`/etkinlikler/${e.id}`)}
            empty={upcoming.isPending ? <LoadingState /> : <EmptyState icon={CalendarDays} title="Yaklaşan etkinlik yok" />}
          />
        </Card>
      )}

      <CollectionDialog open={dialog === "collection"} onOpenChange={(o) => !o && setDialog(null)} />
      <ExpenseDialog open={dialog === "expense"} onOpenChange={(o) => !o && setDialog(null)} />
    </>
  );
}
