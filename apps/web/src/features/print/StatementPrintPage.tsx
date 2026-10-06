import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";

import type { StatementLine } from "@/features/finance/api";
import { PrintLayout, PrintTable } from "@/features/print/PrintLayout";
import { api } from "@/shared/api/client";
import { formatDate, formatMoney, todayISO, type Currency } from "@/shared/lib/format";

/** Ekstre türleri: adres parçası → API yolları ve sütun anlamları. */
const KINDS = {
  musteri: {
    entity: "/customers",
    statement: "/finance/customers",
    label: "Müşteri",
    debit: "Borç",
    credit: "Tahsilat",
    balance: "Müşterinin borcu",
  },
  ortak: {
    entity: "/partners",
    statement: "/finance/partners",
    label: "Ortak",
    debit: "Borç",
    credit: "Alacak",
    balance: "Bakiye",
  },
  sanatci: {
    entity: "/catalog/artists",
    statement: "/finance/artists",
    label: "Sanatçı",
    debit: "Ödeme",
    credit: "Borçlanma",
    balance: "Kalan borcumuz",
  },
  tedarikci: {
    entity: "/catalog/suppliers",
    statement: "/finance/suppliers",
    label: "Tedarikçi",
    debit: "Ödeme",
    credit: "Borçlanma",
    balance: "Kalan borcumuz",
  },
} as const;

export type StatementKind = keyof typeof KINDS;

export function StatementPrintPage() {
  const params = useParams();
  const kind = params.kind as StatementKind;
  const id = Number(params.id);
  const k = KINDS[kind];
  const entity = useQuery({
    enabled: Boolean(k),
    queryKey: ["print", "entity", kind, id],
    queryFn: () => api<{ name?: string; full_name?: string }>(`${k.entity}/${id}`),
  });
  const statement = useQuery({
    enabled: Boolean(k),
    queryKey: ["print", "statement", kind, id],
    queryFn: () => api<StatementLine[]>(`${k.statement}/${id}/statement`),
  });
  if (!k) return <p className="p-8">Geçersiz ekstre türü.</p>;
  const rows = statement.data ?? [];
  const name = entity.data?.name ?? entity.data?.full_name ?? "";
  const balance = rows.length ? rows[rows.length - 1].running_base : "0";

  return (
    <PrintLayout
      kind="CARİ HESAP EKSTRESİ"
      title={name}
      meta={[
        ["Hesap türü", k.label],
        ["Tarih", formatDate(todayISO(), "short")],
        [k.balance, formatMoney(balance)],
      ]}
      loading={entity.isPending || statement.isPending}
      error={entity.error ?? statement.error}
    >
      <PrintTable
        head={[
          { label: "Tarih" },
          { label: "İşlem" },
          { label: k.debit, align: "right" },
          { label: k.credit, align: "right" },
          { label: "Bakiye", align: "right" },
        ]}
      >
        {rows.map((r, index) => (
          <tr key={`${r.entry_id}-${index}`} className={r.is_reversal ? "text-ink-muted" : ""}>
            <td className="whitespace-nowrap">{formatDate(r.entry_date, "short")}</td>
            <td>
              {r.description}
              <span className="block text-[11px] text-ink-muted">
                {r.entry_no}
                {r.currency !== "TRY" && ` · ${formatMoney(r.amount, r.currency as Currency)}`}
              </span>
            </td>
            <td className="text-right tabular">{Number(r.debit) ? formatMoney(r.debit) : ""}</td>
            <td className="text-right tabular">{Number(r.credit) ? formatMoney(r.credit) : ""}</td>
            <td className="text-right font-medium tabular">{formatMoney(r.running_base)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="py-6 text-center text-ink-muted">
              Hareket yok.
            </td>
          </tr>
        )}
      </PrintTable>
      <p className="mt-4 text-right text-base">
        {k.balance}: <strong className="tabular">{formatMoney(balance)}</strong>
      </p>
      <p className="mt-6 text-xs text-ink-muted">
        Tutarlar TL karşılığıdır; döviz işlemlerin orijinal tutarı açıklamada yer alır.
      </p>
    </PrintLayout>
  );
}
