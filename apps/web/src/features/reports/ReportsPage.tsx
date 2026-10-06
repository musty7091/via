import { BarChart3, Download, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { usePartners } from "@/features/partners/api";
import {
  useArtistReport,
  useCustomerReport,
  useEventReport,
  useMonthlyReport,
  type ArtistRow,
  type CustomerRow,
  type DateRange,
  type EventReportRow,
  type MonthRow,
} from "@/features/reports/api";
import { MonthlyChart } from "@/features/reports/MonthlyChart";
import { PeriodSummaryTab } from "@/features/reports/PeriodSummaryTab";
import { parsePeriod, periodOptions, periodRange, type PeriodKey } from "@/features/reports/period";
import { PrintLink } from "@/features/print/PrintLink";
import { csvAmount, downloadCsv } from "@/shared/lib/csv";
import { formatDate, formatMoney, formatNumber } from "@/shared/lib/format";
import { EVENT_STATUS } from "@/shared/lib/labels";
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
  Select,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type Column,
} from "@/shared/ui";

const pct = (value: string | null) => (value == null ? "—" : `%${formatNumber(value)}`);
const sum = <T,>(rows: T[], pick: (row: T) => string) => rows.reduce((total, row) => total + Number(pick(row)), 0);

function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick} disabled={disabled}>
      <Download /> Excel'e aktar
    </Button>
  );
}

// --- Etkinlik kârlılığı ---

const eventColumns: Column<EventReportRow>[] = [
  {
    key: "event",
    header: "Etkinlik",
    cell: (r) => (
      <div className="min-w-0">
        <p className="font-medium text-ink">{r.title}</p>
        <p className="text-xs text-ink-muted">
          {r.event_no} · {r.customer.name}
        </p>
      </div>
    ),
  },
  { key: "date", header: "Tarih", cell: (r) => formatDate(r.event_date, "short") },
  { key: "partner", header: "Ortak", cell: (r) => r.partner.name, hideOnMobile: true },
  { key: "revenue", header: "Gelir", align: "right", cell: (r) => <Money amount={r.revenue} /> },
  {
    key: "cost",
    header: "Maliyet + gider",
    align: "right",
    cell: (r) => <Money amount={String(Number(r.cost) + Number(r.expense) - Number(r.fx))} />,
  },
  {
    key: "profit",
    header: "Kâr",
    align: "right",
    cell: (r) => (
      <span className="inline-flex flex-col items-end">
        <Money amount={r.profit} signed className="font-medium" />
        <span className="text-xs text-ink-muted">{pct(r.margin)}</span>
      </span>
    ),
  },
  {
    key: "receivable",
    header: "Açık alacak",
    align: "right",
    cell: (r) => (Number(r.receivable) > 0 ? <Money amount={r.receivable} className="text-warning-700" /> : "—"),
  },
  {
    key: "status",
    header: "Durum",
    cell: (r) =>
      r.closed ? (
        <Badge tone="success">
          <Lock className="size-3" aria-hidden /> Kapandı
        </Badge>
      ) : (
        <Badge tone={EVENT_STATUS[r.status].tone}>{EVENT_STATUS[r.status].label}</Badge>
      ),
  },
];

function EventsTab({ range, label, period }: { range: DateRange; label: string; period: PeriodKey }) {
  const navigate = useNavigate();
  const partners = usePartners(true);
  const [partnerId, setPartnerId] = useState<number | undefined>();
  const report = useEventReport(range, partnerId);

  const byPartner = useMemo(() => {
    const groups = new Map<string, { count: number; revenue: number; profit: number }>();
    for (const row of report.data?.rows ?? []) {
      const g = groups.get(row.partner.name) ?? { count: 0, revenue: 0, profit: 0 };
      groups.set(row.partner.name, { count: g.count + 1, revenue: g.revenue + Number(row.revenue), profit: g.profit + Number(row.profit) });
    }
    return [...groups.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  }, [report.data]);

  if (report.isPending) return <LoadingState />;
  if (report.isError) return <ErrorState error={report.error} />;
  const { rows, totals, receivable } = report.data;
  const margin = Number(totals.revenue) ? (Number(totals.profit) / Number(totals.revenue)) * 100 : null;

  const exportCsv = () =>
    downloadCsv(
      `etkinlik-karliligi-${label}`,
      ["Etkinlik No", "Etkinlik", "Müşteri", "Ortak", "Tarih", "Durum", "Gelir", "Maliyet", "Gider", "Kur farkı", "Kâr", "Marj %", "Açık alacak"],
      rows.map((r) => [
        r.event_no,
        r.title,
        r.customer.name,
        r.partner.name,
        r.event_date,
        r.closed ? "Kapandı" : EVENT_STATUS[r.status].label,
        csvAmount(r.revenue),
        csvAmount(r.cost),
        csvAmount(r.expense),
        csvAmount(r.fx),
        csvAmount(r.profit),
        csvAmount(r.margin),
        csvAmount(r.receivable),
      ]),
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gelir (KDV hariç)" value={<Money amount={totals.revenue} />} hint={`${rows.length} etkinlik`} />
        <StatCard label="Kâr" value={<Money amount={totals.profit} signed />} tone={Number(totals.profit) < 0 ? "danger" : "success"} />
        <StatCard label="Ortalama marj" value={margin == null ? "—" : `%${formatNumber(margin.toFixed(1))}`} />
        <StatCard label="Açık alacak" value={<Money amount={receivable} />} tone={Number(receivable) > 0 ? "warning" : "default"} />
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Etkinlik Kârlılığı"
            description="Muhasebe kayıtlarından; planlanan etkinliklerde anlaşma rakamları görünür."
            actions={
              <div className="flex flex-wrap gap-2">
                <Select
                  aria-label="Ortak"
                  value={partnerId ?? ""}
                  onChange={(e) => setPartnerId(e.target.value ? Number(e.target.value) : undefined)}
                  className="h-9 w-40"
                >
                  <option value="">Tüm ortaklar</option>
                  {(partners.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </Select>
                <PrintLink to={`/yazdir/rapor/etkinlikler?donem=${period}${partnerId ? `&ortak=${partnerId}` : ""}`} />
                <ExportButton onClick={exportCsv} disabled={rows.length === 0} />
              </div>
            }
          />
          <DataTable
            columns={eventColumns}
            rows={rows}
            rowKey={(r) => r.event_id}
            onRowClick={(r) => navigate(`/etkinlikler/${r.event_id}?sekme=kapanis`)}
            empty={<EmptyState icon={BarChart3} title="Bu dönemde etkinlik yok" />}
          />
        </Card>
        <Card>
          <CardHeader title="Ortak Bazında" description="İşi getiren ortağa göre; kâr her durumda eşit bölünür." />
          {byPartner.length === 0 ? (
            <EmptyState icon={BarChart3} title="Veri yok" />
          ) : (
            <ul className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {byPartner.map(([name, g]) => (
                <li key={name} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-ink">{name}</p>
                    <p className="text-xs text-ink-muted">{g.count} etkinlik</p>
                  </div>
                  <div className="text-right">
                    <Money amount={g.revenue} />
                    <p className="text-xs">
                      <Money amount={g.profit} signed />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// --- Aylık sonuç ---

const monthColumns: Column<MonthRow>[] = [
  { key: "label", header: "Ay", cell: (r) => <span className="font-medium text-ink">{r.label}</span> },
  { key: "events", header: "Etkinlik", align: "right", cell: (r) => r.event_count },
  { key: "revenue", header: "Gelir", align: "right", cell: (r) => <Money amount={r.revenue} /> },
  { key: "event_profit", header: "Etkinlik kârı", align: "right", cell: (r) => <Money amount={r.event_profit} signed /> },
  { key: "general", header: "Genel gider", align: "right", cell: (r) => <Money amount={r.general} signed /> },
  { key: "net", header: "Net sonuç", align: "right", cell: (r) => <Money amount={r.net} signed className="font-medium" /> },
  { key: "collections", header: "Tahsilat", align: "right", cell: (r) => <Money amount={r.collections} />, hideOnMobile: true },
];

function MonthlyTab({ first, last, label, period }: { first: string; last: string; label: string; period: PeriodKey }) {
  const report = useMonthlyReport(first, last);
  if (report.isPending) return <LoadingState />;
  if (report.isError) return <ErrorState error={report.error} />;
  const { rows, totals } = report.data;
  const active = rows.filter((r) => r.event_count > 0 || [r.revenue, r.general, r.net, r.collections].some((v) => Number(v) !== 0));
  const exportCsv = () =>
    downloadCsv(
      `aylik-sonuc-${label}`,
      ["Ay", "Etkinlik", "Gelir", "Etkinlik maliyeti", "Etkinlik kârı", "Genel gider", "Net sonuç", "Tahsilat"],
      [...rows, totals].map((r) => [
        r.label,
        r.event_count,
        csvAmount(r.revenue),
        csvAmount(r.event_cost),
        csvAmount(r.event_profit),
        csvAmount(r.general),
        csvAmount(r.net),
        csvAmount(r.collections),
      ]),
    );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gelir" value={<Money amount={totals.revenue} />} hint={`${totals.event_count} etkinlik`} />
        <StatCard label="Etkinlik kârı" value={<Money amount={totals.event_profit} signed />} />
        <StatCard label="Genel giderler" value={<Money amount={totals.general} signed />} tone="warning" />
        <StatCard label="Net sonuç" value={<Money amount={totals.net} signed />} tone={Number(totals.net) < 0 ? "danger" : "success"} />
      </div>
      <Card>
        <CardHeader
          title="Aylık Sonuç"
          description="Etkinlik sonucu etkinliğin yapıldığı aya, genel giderler (aylara bölünenler dahil) kendi ayına yazılır."
          actions={
            <div className="flex flex-wrap gap-2">
              <PrintLink to={`/yazdir/rapor/aylik?donem=${period}`} />
              <ExportButton onClick={exportCsv} />
            </div>
          }
        />
        <div className="border-b border-line px-5 py-5">
          <MonthlyChart rows={rows} />
        </div>
        <DataTable
          columns={monthColumns}
          rows={active}
          rowKey={(r) => r.month}
          empty={<EmptyState icon={BarChart3} title="Bu dönemde hareket yok" />}
        />
        {active.length < rows.length && active.length > 0 && (
          <p className="border-t border-line px-5 py-3 text-sm text-ink-muted">Hareketsiz {rows.length - active.length} ay listede gösterilmiyor.</p>
        )}
      </Card>
    </div>
  );
}

// --- Sanatçılar ---

const artistColumns: Column<ArtistRow>[] = [
  { key: "artist", header: "Sanatçı", cell: (r) => <span className="font-medium text-ink">{r.artist.name}</span> },
  { key: "events", header: "Etkinlik", align: "right", cell: (r) => r.event_count },
  { key: "sales", header: "Satış", align: "right", cell: (r) => <Money amount={r.sales} /> },
  { key: "cost", header: "Maliyet", align: "right", cell: (r) => <Money amount={r.cost} /> },
  {
    key: "margin",
    header: "Brüt kâr",
    align: "right",
    cell: (r) => (
      <span className="inline-flex flex-col items-end">
        <Money amount={r.margin} signed className="font-medium" />
        <span className="text-xs text-ink-muted">{Number(r.sales) ? pct(((Number(r.margin) / Number(r.sales)) * 100).toFixed(1)) : "—"}</span>
      </span>
    ),
  },
];

function ArtistsTab({ range, label, period }: { range: DateRange; label: string; period: PeriodKey }) {
  const navigate = useNavigate();
  const report = useArtistReport(range);
  if (report.isPending) return <LoadingState />;
  if (report.isError) return <ErrorState error={report.error} />;
  const rows = report.data;
  const exportCsv = () =>
    downloadCsv(
      `sanatci-raporu-${label}`,
      ["Sanatçı", "Etkinlik", "Satış", "Maliyet", "Brüt kâr"],
      rows.map((r) => [r.artist.name, r.event_count, csvAmount(r.sales), csvAmount(r.cost), csvAmount(r.margin)]),
    );
  return (
    <Card>
      <CardHeader
        title="Sanatçı Raporu"
        description="Anlaşma rakamlarıyla. Paket fiyatı, içindeki kalemlere maliyetleri oranında dağıtılır."
        actions={
          <div className="flex flex-wrap gap-2">
            <PrintLink to={`/yazdir/rapor/sanatcilar?donem=${period}`} />
            <ExportButton onClick={exportCsv} disabled={rows.length === 0} />
          </div>
        }
      />
      <DataTable
        columns={artistColumns}
        rows={rows}
        rowKey={(r) => r.artist.id}
        onRowClick={(r) => navigate(`/katalog/sanatcilar/${r.artist.id}`)}
        empty={<EmptyState icon={BarChart3} title="Bu dönemde sanatçılı etkinlik yok" />}
      />
      {rows.length > 0 && (
        <p className="border-t border-line px-5 py-3 text-sm text-ink-muted">
          Toplam satış {formatMoney(sum(rows, (r) => r.sales))} · maliyet {formatMoney(sum(rows, (r) => r.cost))}
        </p>
      )}
    </Card>
  );
}

// --- Müşteriler ---

const customerColumns: Column<CustomerRow>[] = [
  { key: "customer", header: "Müşteri", cell: (r) => <span className="font-medium text-ink">{r.customer.name}</span> },
  { key: "events", header: "Etkinlik", align: "right", cell: (r) => r.event_count },
  { key: "revenue", header: "Gelir", align: "right", cell: (r) => <Money amount={r.revenue} /> },
  { key: "profit", header: "Kâr", align: "right", cell: (r) => <Money amount={r.profit} signed /> },
  { key: "collected", header: "Tahsil edilen", align: "right", cell: (r) => <Money amount={r.collected} />, hideOnMobile: true },
  {
    key: "receivable",
    header: "Açık alacak",
    align: "right",
    cell: (r) => (Number(r.receivable) > 0 ? <Money amount={r.receivable} className="text-warning-700" /> : "—"),
  },
];

function CustomersTab({ range, label, period }: { range: DateRange; label: string; period: PeriodKey }) {
  const navigate = useNavigate();
  const report = useCustomerReport(range);
  if (report.isPending) return <LoadingState />;
  if (report.isError) return <ErrorState error={report.error} />;
  const rows = report.data;
  const exportCsv = () =>
    downloadCsv(
      `musteri-raporu-${label}`,
      ["Müşteri", "Etkinlik", "Gelir", "Kâr", "Tahsil edilen", "Açık alacak"],
      rows.map((r) => [r.customer.name, r.event_count, csvAmount(r.revenue), csvAmount(r.profit), csvAmount(r.collected), csvAmount(r.receivable)]),
    );
  return (
    <Card>
      <CardHeader
        title="Müşteri Raporu"
        description="Dönemdeki etkinliklere göre; gelire göre sıralı."
        actions={
          <div className="flex flex-wrap gap-2">
            <PrintLink to={`/yazdir/rapor/musteriler?donem=${period}`} />
            <ExportButton onClick={exportCsv} disabled={rows.length === 0} />
          </div>
        }
      />
      <DataTable
        columns={customerColumns}
        rows={rows}
        rowKey={(r) => r.customer.id}
        onRowClick={(r) => navigate(`/musteriler/${r.customer.id}`)}
        empty={<EmptyState icon={BarChart3} title="Bu dönemde etkinlik yok" />}
      />
    </Card>
  );
}

// --- Sayfa ---

const TABS = ["ozet", "etkinlikler", "aylik", "sanatcilar", "musteriler"] as const;

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t === params.get("sekme")) ?? "ozet";
  const options = periodOptions();
  const period = parsePeriod(params.get("donem"));
  const range = periodRange(period);
  const dateRange = { date_from: range.date_from, date_to: range.date_to };
  const label = period === "last12" ? "son-12-ay" : period;
  const update = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );

  return (
    <>
      <PageHeader
        eyebrow="Finans"
        title="Raporlar"
        description="Tüm tutarlar TL karşılığıdır ve KDV hariçtir."
        actions={
          tab !== "ozet" && (
            <Select aria-label="Dönem" value={period} onChange={(e) => update("donem", e.target.value)} className="w-40">
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )
        }
      />
      <Tabs value={tab} onValueChange={(value) => update("sekme", value)}>
        <TabsList>
          <TabsTrigger value="ozet">Dönem Özeti</TabsTrigger>
          <TabsTrigger value="etkinlikler">Etkinlik Kârlılığı</TabsTrigger>
          <TabsTrigger value="aylik">Aylık Sonuç</TabsTrigger>
          <TabsTrigger value="sanatcilar">Sanatçılar</TabsTrigger>
          <TabsTrigger value="musteriler">Müşteriler</TabsTrigger>
        </TabsList>
        <TabsContent value="ozet">
          <PeriodSummaryTab month={params.get("ay") ?? undefined} onMonth={(m) => update("ay", m)} />
        </TabsContent>
        <TabsContent value="etkinlikler">
          <EventsTab range={dateRange} label={label} period={period} />
        </TabsContent>
        <TabsContent value="aylik">
          <MonthlyTab first={range.first} last={range.last} label={label} period={period} />
        </TabsContent>
        <TabsContent value="sanatcilar">
          <ArtistsTab range={dateRange} label={label} period={period} />
        </TabsContent>
        <TabsContent value="musteriler">
          <CustomersTab range={dateRange} label={label} period={period} />
        </TabsContent>
      </Tabs>
    </>
  );
}
