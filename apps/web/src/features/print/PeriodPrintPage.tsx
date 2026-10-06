import { useParams } from "react-router";

import { usePeriod } from "@/features/closing/api";
import { PrintLayout, PrintSection, PrintTable } from "@/features/print/PrintLayout";
import { formatDate, formatMoney, type Currency } from "@/shared/lib/format";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className={strong ? "font-semibold" : ""}>
      <td>{label}</td>
      <td className="text-right tabular">{value}</td>
    </tr>
  );
}

/** Aylık dönem raporu (muhasebe ve ortaklar için). Kapalı dönemde kapanış anındaki haliyle. */
export function PeriodPrintPage() {
  const month = useParams().month ?? "";
  const period = usePeriod(month);
  const p = period.data;

  return (
    <PrintLayout
      kind="DÖNEM RAPORU"
      title={p?.label ?? ""}
      meta={p ? [["Durum", p.status === "closed" ? "Kapalı" : "Açık (rakamlar canlı)"]] : []}
      loading={period.isPending}
      error={period.error}
    >
      {p && (
        <>
          <div className="grid grid-cols-2 gap-8">
            <PrintSection title="Ay özeti (TL)">
              <PrintTable head={[{ label: "Kalem" }, { label: "Tutar", align: "right" }]}>
                <Row label="Kapanan etkinliklerin kârı" value={formatMoney(p.closed_events_profit)} />
                <Row label="Genel giderler" value={formatMoney(-Number(p.general.direct_expenses))} />
                {Number(p.general.spread_expenses) > 0 && (
                  <Row label="Aylara bölünen giderlerin payı" value={formatMoney(-Number(p.general.spread_expenses))} />
                )}
                {Number(p.general.fx) !== 0 && <Row label="Kur farkı" value={formatMoney(p.general.fx)} />}
                <Row label="Ay sonucu" value={formatMoney(p.month_result)} strong />
              </PrintTable>
            </PrintSection>
            <PrintSection title="Nakit hareketleri (TL)">
              <PrintTable head={[{ label: "Kalem" }, { label: "Tutar", align: "right" }]}>
                <Row label="Tahsilatlar" value={formatMoney(p.collections_base)} />
                <Row label="Sanatçı / tedarikçi ödemeleri" value={formatMoney(p.payments_base)} />
                <Row label="Ay sonu açık alacak" value={formatMoney(p.receivables_base)} />
                <Row label="Ay sonu açık borç" value={formatMoney(p.payables_base)} />
              </PrintTable>
            </PrintSection>
          </div>

          <PrintSection title="Kasa ve banka (ay sonu)">
            <PrintTable head={[{ label: "Hesap" }, { label: "Bakiye", align: "right" }, { label: "TL karşılığı", align: "right" }]}>
              {p.cash.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className="text-right tabular">{formatMoney(c.amount, c.currency as Currency)}</td>
                  <td className="text-right tabular">{formatMoney(c.base)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td colSpan={2}>Toplam</td>
                <td className="text-right tabular">{formatMoney(p.cash_total_base)}</td>
              </tr>
            </PrintTable>
          </PrintSection>

          {p.events.length > 0 && (
            <PrintSection title="Ayın etkinlikleri">
              <PrintTable head={[{ label: "Tarih" }, { label: "Etkinlik" }, { label: "Durum" }, { label: "Kâr / zarar", align: "right" }]}>
                {p.events.map((e) => (
                  <tr key={e.event_id}>
                    <td className="whitespace-nowrap">{formatDate(e.event_date, "short")}</td>
                    <td>
                      {e.title}
                      <span className="block text-[11px] text-ink-muted">{e.event_no}</span>
                    </td>
                    <td>{e.closed ? "Kapandı" : "Açık"}</td>
                    <td className="text-right tabular">{e.profit != null ? formatMoney(e.profit) : "—"}</td>
                  </tr>
                ))}
              </PrintTable>
            </PrintSection>
          )}

          <PrintSection title="Ortak hesapları (ay sonu)">
            <PrintTable
              head={[
                { label: "Ortak" },
                { label: "Bu ay kâr/zarar payı", align: "right" },
                { label: "Üzerindeki şirket parası", align: "right" },
                { label: "Şirketin ona borcu", align: "right" },
              ]}
            >
              {p.partners.map((x) => (
                <tr key={x.partner_id}>
                  <td>{x.name}</td>
                  <td className="text-right tabular">{formatMoney(x.distributed_in_month)}</td>
                  <td className="text-right tabular">{formatMoney(x.held_base)}</td>
                  <td className="text-right tabular">{formatMoney(x.owed_base)}</td>
                </tr>
              ))}
            </PrintTable>
          </PrintSection>

          {p.warnings.length > 0 && (
            <ul className="mt-6 list-disc pl-5 text-sm text-ink-soft">
              {p.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-xs text-ink-muted">Tutarlar TL karşılığıdır. Kâr ve zarar ortaklara eşit bölünür.</p>
        </>
      )}
    </PrintLayout>
  );
}
