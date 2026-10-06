import { Printer } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useCompany } from "@/features/print/company";
import { formatDateTime } from "@/shared/lib/format";
import { Button, ErrorState, LoadingState } from "@/shared/ui";

interface Props {
  /** Belge türü (ör. "CARİ HESAP EKSTRESİ"), başlığın üstünde küçük etiket */
  kind: string;
  title: string;
  /** Sağ üstte etiket/değer çiftleri (belge no, tarih...) */
  meta?: [string, ReactNode][];
  loading?: boolean;
  error?: unknown;
  children?: ReactNode;
}

/**
 * Tüm çıktıların ortak A4 iskeleti: logo, şirket bilgisi, başlık, yazdırma butonu.
 * Tarayıcının "Yazdır → PDF olarak kaydet" özelliğiyle PDF'e dönüşür.
 */
export function PrintLayout({ kind, title, meta, loading, error, children }: Props) {
  const company = useCompany();
  const [createdAt] = useState(() => new Date().toISOString());
  if (loading || company.isPending) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  const co = company.data;

  return (
    <div className="min-h-dvh bg-canvas py-6 print:bg-white print:py-0">
      <style>{"@page { size: A4; margin: 12mm; } @media print { body { background: white; } }"}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer /> Yazdır / PDF olarak kaydet
        </Button>
      </div>
      <article className="mx-auto max-w-[210mm] bg-white px-10 py-10 text-ink shadow-card print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-5">
          <img src="/brand/via-logo-horizontal.png" alt={co?.company_name ?? "VIA EVENTS"} className="h-9 w-auto" />
          {co && (
            <div className="text-right text-xs leading-relaxed text-ink-soft">
              <p className="font-medium text-ink">{co.legal_name ?? co.company_name}</p>
              {co.address && <p>{co.address}</p>}
              {(co.phone || co.email) && <p>{[co.phone, co.email].filter(Boolean).join(" · ")}</p>}
              {co.tax_number && (
                <p>
                  {co.tax_office} {co.tax_number}
                </p>
              )}
            </div>
          )}
        </header>
        <section className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-xs tracking-[0.35em] text-accent-600">{kind}</p>
            <h1 className="mt-1 font-display text-2xl font-light">{title}</h1>
          </div>
          {meta && meta.length > 0 && (
            <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm">
              {meta.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
        <div className="mt-6">{children}</div>
        <footer className="mt-10 border-t border-line pt-3 text-[11px] text-ink-muted">
          {co?.company_name ?? "VIA EVENTS"} · Oluşturulma: {formatDateTime(createdAt)}
        </footer>
      </article>
    </div>
  );
}

/** Çıktılarda kullanılan sade tablo. */
export function PrintTable({ head, children }: { head: { label: string; align?: "right" }[]; children: ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b-2 border-brand-900 text-left text-xs tracking-wider text-ink-muted uppercase">
          {head.map((h) => (
            <th key={h.label} className={`py-2 pr-2 font-medium ${h.align === "right" ? "text-right" : ""}`}>
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="[&_td]:border-b [&_td]:border-line [&_td]:py-1.5 [&_td]:pr-2 [&_td]:align-top [&_tr]:break-inside-avoid">
        {children}
      </tbody>
    </table>
  );
}

export function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-xs font-semibold tracking-[0.2em] text-brand-900 uppercase">{title}</h2>
      {children}
    </section>
  );
}
