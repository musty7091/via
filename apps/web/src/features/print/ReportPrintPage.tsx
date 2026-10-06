import type { ReactNode } from "react";
import { useParams, useSearchParams } from "react-router";

import { usePartners } from "@/features/partners/api";
import { PrintLayout, PrintTable } from "@/features/print/PrintLayout";
import {
  useArtistReport,
  useCustomerReport,
  useEventReport,
  useMonthlyReport,
} from "@/features/reports/api";
import { MonthlyChart } from "@/features/reports/MonthlyChart";
import { parsePeriod, periodLabel, periodRange } from "@/features/reports/period";
import { formatDate, formatMoney, formatNumber } from "@/shared/lib/format";
import { EVENT_STATUS } from "@/shared/lib/labels";

const pct = (value: number | string | null | undefined) =>
  value == null || value === "" ? "—" : `%${formatNumber(Number(value).toFixed(1))}`;

/** Raporun üstündeki özet kutuları. */
function Totals({ items }: { items: [string, string][] }) {
  return (
    <div className="mb-6 grid grid-cols-4 gap-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-line p-3">
          <p className="text-[11px] tracking-wider text-ink-muted uppercase">{label}</p>
          <p className="mt-1 text-base font-semibold tabular">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Num({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return <td className={`text-right whitespace-nowrap tabular ${strong ? "font-semibold" : ""}`}>{children}</td>;
}

function EventsReport({ range, partnerId }: { range: { date_from: string; date_to: string }; partnerId?: number }) {
  const report = useEventReport(range, partnerId);
  if (!report.data) return null;
  const { rows, totals, receivable } = report.data;
  const margin = Number(totals.revenue) ? (Number(totals.profit) / Number(totals.revenue)) * 100 : null;
  return (
    <>
      <Totals
        items={[
          ["Gelir", formatMoney(totals.revenue)],
          ["Kâr", formatMoney(totals.profit)],
          ["Ortalama marj", pct(margin)],
          ["Açık alacak", formatMoney(receivable)],
        ]}
      />
      <PrintTable
        head={[
          { label: "Tarih" },
          { label: "Etkinlik" },
          { label: "Ortak" },
          { label: "Gelir", align: "right" },
          { label: "Maliyet+gider", align: "right" },
          { label: "Kâr", align: "right" },
          { label: "Marj", align: "right" },
          { label: "Durum" },
        ]}
      >
        {rows.map((r) => (
          <tr key={r.event_id}>
            <td className="whitespace-nowrap">{formatDate(r.event_date, "short")}</td>
            <td>
              {r.title}
              <span className="block text-[11px] text-ink-muted">
                {r.event_no} · {r.customer.name}
              </span>
            </td>
            <td>{r.partner.name}</td>
            <Num>{formatMoney(r.revenue)}</Num>
            <Num>{formatMoney(Number(r.cost) + Number(r.expense) - Number(r.fx))}</Num>
            <Num strong>{formatMoney(r.profit)}</Num>
            <Num>{pct(r.margin)}</Num>
            <td>{r.closed ? "Kapandı" : EVENT_STATUS[r.status].label}</td>
          </tr>
        ))}
        <tr className="font-semibold">
          <td colSpan={3}>Toplam ({rows.length} etkinlik)</td>
          <Num>{formatMoney(totals.revenue)}</Num>
          <Num>{formatMoney(Number(totals.cost) + Number(totals.expense) - Number(totals.fx))}</Num>
          <Num>{formatMoney(totals.profit)}</Num>
          <Num>{pct(margin)}</Num>
          <td />
        </tr>
      </PrintTable>
    </>
  );
}

function MonthlyReport({ first, last }: { first: string; last: string }) {
  const report = useMonthlyReport(first, last);
  if (!report.data) return null;
  const { rows, totals } = report.data;
  const active = rows.filter((r) => r.event_count > 0 || [r.revenue, r.general, r.net, r.collections].some((v) => Number(v) !== 0));
  return (
    <>
      <Totals
        items={[
          ["Gelir", formatMoney(totals.revenue)],
          ["Etkinlik kârı", formatMoney(totals.event_profit)],
          ["Genel giderler", formatMoney(totals.general)],
          ["Net sonuç", formatMoney(totals.net)],
        ]}
      />
      <div className="mb-6 break-inside-avoid">
        <MonthlyChart rows={rows} />
      </div>
      <PrintTable
        head={[
          { label: "Ay" },
          { label: "Etkinlik", align: "right" },
          { label: "Gelir", align: "right" },
          { label: "Etkinlik kârı", align: "right" },
          { label: "Genel gider", align: "right" },
          { label: "Net sonuç", align: "right" },
          { label: "Tahsilat", align: "right" },
        ]}
      >
        {active.map((r) => (
          <tr key={r.month}>
            <td>{r.label}</td>
            <Num>{r.event_count}</Num>
            <Num>{formatMoney(r.revenue)}</Num>
            <Num>{formatMoney(r.event_profit)}</Num>
            <Num>{formatMoney(r.general)}</Num>
            <Num strong>{formatMoney(r.net)}</Num>
            <Num>{formatMoney(r.collections)}</Num>
          </tr>
        ))}
        <tr className="font-semibold">
          <td>Toplam</td>
          <Num>{totals.event_count}</Num>
          <Num>{formatMoney(totals.revenue)}</Num>
          <Num>{formatMoney(totals.event_profit)}</Num>
          <Num>{formatMoney(totals.general)}</Num>
          <Num>{formatMoney(totals.net)}</Num>
          <Num>{formatMoney(totals.collections)}</Num>
        </tr>
      </PrintTable>
      {active.length < rows.length && (
        <p className="mt-2 text-xs text-ink-muted">Hareketsiz {rows.length - active.length} ay tabloda gösterilmiyor.</p>
      )}
    </>
  );
}

function ArtistsReport({ range }: { range: { date_from: string; date_to: string } }) {
  const report = useArtistReport(range);
  if (!report.data) return null;
  const rows = report.data;
  const sales = rows.reduce((t, r) => t + Number(r.sales), 0);
  const cost = rows.reduce((t, r) => t + Number(r.cost), 0);
  return (
    <>
      <Totals
        items={[
          ["Sanatçı", String(rows.length)],
          ["Satış", formatMoney(sales)],
          ["Maliyet", formatMoney(cost)],
          ["Brüt kâr", formatMoney(sales - cost)],
        ]}
      />
      <PrintTable
        head={[
          { label: "Sanatçı" },
          { label: "Etkinlik", align: "right" },
          { label: "Satış", align: "right" },
          { label: "Maliyet", align: "right" },
          { label: "Brüt kâr", align: "right" },
          { label: "Marj", align: "right" },
        ]}
      >
        {rows.map((r) => (
          <tr key={r.artist.id}>
            <td>{r.artist.name}</td>
            <Num>{r.event_count}</Num>
            <Num>{formatMoney(r.sales)}</Num>
            <Num>{formatMoney(r.cost)}</Num>
            <Num strong>{formatMoney(r.margin)}</Num>
            <Num>{Number(r.sales) ? pct((Number(r.margin) / Number(r.sales)) * 100) : "—"}</Num>
          </tr>
        ))}
      </PrintTable>
      <p className="mt-3 text-xs text-ink-muted">Anlaşma rakamlarıyla. Paket fiyatı, içindeki kalemlere maliyetleri oranında dağıtılır.</p>
    </>
  );
}

function CustomersReport({ range }: { range: { date_from: string; date_to: string } }) {
  const report = useCustomerReport(range);
  if (!report.data) return null;
  const rows = report.data;
  const total = (pick: (r: (typeof rows)[number]) => string) => rows.reduce((t, r) => t + Number(pick(r)), 0);
  return (
    <>
      <Totals
        items={[
          ["Müşteri", String(rows.length)],
          ["Gelir", formatMoney(total((r) => r.revenue))],
          ["Tahsil edilen", formatMoney(total((r) => r.collected))],
          ["Açık alacak", formatMoney(total((r) => r.receivable))],
        ]}
      />
      <PrintTable
        head={[
          { label: "Müşteri" },
          { label: "Etkinlik", align: "right" },
          { label: "Gelir", align: "right" },
          { label: "Kâr", align: "right" },
          { label: "Tahsil edilen", align: "right" },
          { label: "Açık alacak", align: "right" },
        ]}
      >
        {rows.map((r) => (
          <tr key={r.customer.id}>
            <td>{r.customer.name}</td>
            <Num>{r.event_count}</Num>
            <Num>{formatMoney(r.revenue)}</Num>
            <Num>{formatMoney(r.profit)}</Num>
            <Num>{formatMoney(r.collected)}</Num>
            <Num strong>{formatMoney(r.receivable)}</Num>
          </tr>
        ))}
      </PrintTable>
    </>
  );
}

const TITLES = {
  etkinlikler: "Etkinlik Kârlılığı",
  aylik: "Aylık Sonuç",
  sanatcilar: "Sanatçı Raporu",
  musteriler: "Müşteri Raporu",
} as const;

/** Raporlar sayfasının dört raporunun A4 çıktısı (seçili dönem ve filtreyle). */
export function ReportPrintPage() {
  const type = useParams().type as keyof typeof TITLES;
  const [params] = useSearchParams();
  const period = parsePeriod(params.get("donem"));
  const range = periodRange(period);
  const dateRange = { date_from: range.date_from, date_to: range.date_to };
  const partnerId = Number(params.get("ortak")) || undefined;
  const partners = usePartners(true, Boolean(partnerId));
  const partnerName = partners.data?.find((p) => p.id === partnerId)?.full_name;
  if (!TITLES[type]) return <p className="p-8">Geçersiz rapor.</p>;

  const meta: [string, string][] = [
    ["Dönem", periodLabel(period)],
    ["Aralık", `${formatDate(range.date_from, "short")} – ${formatDate(range.date_to, "short")}`],
  ];
  if (partnerName) meta.push(["Ortak", partnerName]);

  return (
    <PrintLayout kind="YÖNETİM RAPORU" title={TITLES[type]} meta={meta}>
      {type === "etkinlikler" && <EventsReport range={dateRange} partnerId={partnerId} />}
      {type === "aylik" && <MonthlyReport first={range.first} last={range.last} />}
      {type === "sanatcilar" && <ArtistsReport range={dateRange} />}
      {type === "musteriler" && <CustomersReport range={dateRange} />}
      <p className="mt-6 text-xs text-ink-muted">Tutarlar TL karşılığıdır ve KDV hariçtir; muhasebe kayıtlarından hesaplanır.</p>
    </PrintLayout>
  );
}
