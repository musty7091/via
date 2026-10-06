import { Printer } from "lucide-react";
import { useParams } from "react-router";

import { useOfferPrint, type OfferPrint } from "@/features/offers/api";
import { formatDate, formatMoney, formatNumber, type Currency } from "@/shared/lib/format";
import { Button, ErrorState, LoadingState } from "@/shared/ui";

/**
 * Müşteriye verilecek teklif çıktısı (A4). Maliyet ve iç not içermez.
 * Tarayıcının "Yazdır → PDF olarak kaydet" özelliğiyle PDF'e dönüşür.
 */

const hhmm = (v: string | null) => (v ? v.slice(0, 5) : "");

function Totals({ data }: { data: OfferPrint }) {
  const c = data.currency as Currency;
  const rows: [string, string, boolean?][] = [["Ara toplam", formatMoney(data.subtotal, c)]];
  if (Number(data.discount_amount) > 0) rows.push(["İndirim", `-${formatMoney(data.discount_amount, c)}`]);
  if (data.invoice_type === "with_invoice") {
    if (Number(data.discount_amount) > 0) rows.push(["KDV hariç toplam", formatMoney(data.net_amount, c)]);
    rows.push([`KDV (%${formatNumber(data.vat_rate)})`, formatMoney(data.vat_amount, c)]);
  }
  rows.push(["Genel toplam", formatMoney(data.total_amount, c), true]);
  if (Number(data.advance_amount) > 0) {
    rows.push(["Ön ödeme (kapora)", formatMoney(data.advance_amount, c)]);
    rows.push(["Kalan", formatMoney(data.remaining_amount, c)]);
  }
  return (
    <table className="ml-auto w-72 text-sm">
      <tbody>
        {rows.map(([label, value, strong]) => (
          <tr key={label} className={strong ? "border-t-2 border-brand-900 text-base font-semibold" : ""}>
            <td className="py-1 pr-4 text-ink-soft">{label}</td>
            <td className="py-1 text-right tabular">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function OfferPrintPage() {
  const id = Number(useParams().id);
  const query = useOfferPrint(id);
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} />;
  const d = query.data;
  const c = d.currency as Currency;
  const co = d.company;

  return (
    <div className="min-h-dvh bg-canvas py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 14mm; } @media print { body { background: white; } }`}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer /> Yazdır / PDF olarak kaydet
        </Button>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white px-10 py-10 text-ink shadow-card print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
          <img src="/brand/via-logo-horizontal.png" alt={co.company_name} className="h-10 w-auto" />
          <div className="text-right text-xs leading-relaxed text-ink-soft">
            <p className="font-medium text-ink">{co.legal_name ?? co.company_name}</p>
            {co.address && <p>{co.address}</p>}
            {(co.phone || co.email) && <p>{[co.phone, co.email].filter(Boolean).join(" · ")}</p>}
            {co.website && <p>{co.website}</p>}
            {co.tax_number && (
              <p>
                {co.tax_office} {co.tax_number}
              </p>
            )}
          </div>
        </header>

        <section className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-xs tracking-[0.35em] text-accent-600">TEKLİF</p>
            <h1 className="mt-1 font-display text-2xl font-light">{d.title}</h1>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm">
            <dt className="text-ink-muted">Teklif no</dt>
            <dd className="text-right font-medium">{d.offer_no}</dd>
            <dt className="text-ink-muted">Tarih</dt>
            <dd className="text-right">{formatDate(d.offer_date, "short")}</dd>
            <dt className="text-ink-muted">Geçerlilik</dt>
            <dd className="text-right">{formatDate(d.valid_until, "short")}</dd>
          </dl>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-md bg-surface-muted p-4 print:border print:border-line print:bg-white">
            <p className="text-xs tracking-wider text-ink-muted uppercase">Sayın</p>
            <p className="mt-1 font-medium">{d.customer_name}</p>
            {d.contact_name && <p>{d.contact_name}{d.contact_phone ? ` · ${d.contact_phone}` : ""}</p>}
            {d.customer_address && <p className="text-ink-soft">{d.customer_address}</p>}
            {d.customer_tax && <p className="text-ink-soft">{d.customer_tax}</p>}
          </div>
          <div className="rounded-md bg-surface-muted p-4 print:border print:border-line print:bg-white">
            <p className="text-xs tracking-wider text-ink-muted uppercase">Etkinlik</p>
            <p className="mt-1 font-medium">{d.event_date ? formatDate(d.event_date) : "Tarih belirlenecek"}</p>
            {d.event_start && <p>{hhmm(d.event_start)} – {hhmm(d.event_end)}</p>}
            {d.venue_name && <p className="text-ink-soft">{d.venue_name}</p>}
            {d.guest_count && <p className="text-ink-soft">{d.guest_count} kişi</p>}
          </div>
        </section>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-brand-900 text-left text-xs tracking-wider text-ink-muted uppercase">
              <th className="py-2 font-medium">Program / Hizmet</th>
              <th className="w-24 py-2 font-medium">Saat</th>
              <th className="w-16 py-2 text-right font-medium">Miktar</th>
              <th className="w-32 py-2 text-right font-medium">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((line, index) => (
              <FragmentRows key={index} line={line} currency={c} />
            ))}
          </tbody>
        </table>

        <section className="mt-6 break-inside-avoid">
          <Totals data={d} />
          <p className="mt-2 text-right text-xs text-ink-muted">
            {d.invoice_type === "with_invoice" ? "Fiyatlara KDV dahildir." : "Faturasız fiyattır."}
          </p>
        </section>

        {(d.payment_terms || d.customer_notes) && (
          <section className="mt-8 space-y-4 text-sm break-inside-avoid">
            {d.payment_terms && (
              <div>
                <p className="text-xs tracking-wider text-ink-muted uppercase">Ödeme şartları</p>
                <p className="mt-1 whitespace-pre-line">{d.payment_terms}</p>
                {co.iban && <p className="mt-1 text-ink-soft">IBAN: {co.iban}</p>}
              </div>
            )}
            {d.customer_notes && (
              <div>
                <p className="text-xs tracking-wider text-ink-muted uppercase">Notlar</p>
                <p className="mt-1 whitespace-pre-line">{d.customer_notes}</p>
              </div>
            )}
          </section>
        )}

        <section className="mt-12 grid grid-cols-2 gap-10 text-sm break-inside-avoid">
          {[co.company_name, d.customer_name].map((name) => (
            <div key={name}>
              <div className="h-16 border-b border-line-strong" />
              <p className="mt-1 text-xs text-ink-muted">{name} · Kaşe / İmza</p>
            </div>
          ))}
        </section>

        {co.offer_footer_note && <p className="mt-8 text-center text-xs text-ink-muted">{co.offer_footer_note}</p>}
      </article>
    </div>
  );
}

function FragmentRows({ line, currency }: { line: OfferPrint["lines"][number]; currency: Currency }) {
  return (
    <>
      <tr className="border-b border-line align-top">
        <td className="py-2.5 pr-3">
          <p className="font-medium">{line.title}</p>
          {line.description && <p className="text-xs whitespace-pre-line text-ink-soft">{line.description}</p>}
        </td>
        <td className="py-2.5 text-ink-soft tabular">{line.start_time ? `${hhmm(line.start_time)}–${hhmm(line.end_time)}` : ""}</td>
        <td className="py-2.5 text-right tabular">{formatNumber(line.quantity)}</td>
        <td className="py-2.5 text-right font-medium tabular">{line.line_total ? formatMoney(line.line_total, currency) : ""}</td>
      </tr>
      {(line.components ?? []).map((component, index) => (
        <tr key={index} className="border-b border-line/60 text-ink-soft">
          <td className="py-1.5 pr-3 pl-5">· {component.title}</td>
          <td className="py-1.5 tabular">{component.start_time ? `${hhmm(component.start_time)}–${hhmm(component.end_time)}` : ""}</td>
          <td className="py-1.5 text-right tabular">{formatNumber(component.quantity)}</td>
          <td className="py-1.5 text-right text-xs">Dahil</td>
        </tr>
      ))}
    </>
  );
}
