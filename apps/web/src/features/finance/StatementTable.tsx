import { ScrollText } from "lucide-react";
import { Link } from "react-router";

import type { StatementLine } from "@/features/finance/api";
import { formatDate } from "@/shared/lib/format";
import { ACCOUNT_LABELS } from "@/shared/lib/labels";
import { DataTable, EmptyState, LoadingState, Money, type Column } from "@/shared/ui";

interface Props {
  rows: StatementLine[];
  loading?: boolean;
  /** Borç/alacak sütun başlıkları (ör. müşteri carisinde "Borç" = etkinlik bedeli) */
  debitLabel: string;
  creditLabel: string;
  balanceLabel: string;
}

/** Cari hesap ekstresi: TL karşılığıyla, yürüyen bakiyeli. */
export function StatementTable({ rows, loading, debitLabel, creditLabel, balanceLabel }: Props) {
  const columns: Column<StatementLine>[] = [
    {
      key: "desc",
      header: "İşlem",
      cell: (l) => (
        <div className={l.is_reversal ? "text-ink-muted" : ""}>
          <p className="text-ink">{l.description}</p>
          <p className="text-xs text-ink-muted">
            {l.entry_no} · {ACCOUNT_LABELS[l.account] ?? l.account}
            {l.currency !== "TRY" && (
              <>
                {" "}
                · <Money amount={l.amount} currency={l.currency} />
              </>
            )}
            {l.event_id && (
              <>
                {" · "}
                <Link to={`/etkinlikler/${l.event_id}?sekme=odemeler`} className="hover:underline">
                  etkinlik
                </Link>
              </>
            )}
          </p>
        </div>
      ),
    },
    { key: "date", header: "Tarih", cell: (l) => formatDate(l.entry_date, "short") },
    { key: "debit", header: debitLabel, align: "right", cell: (l) => (Number(l.debit) ? <Money amount={l.debit} /> : "") },
    { key: "credit", header: creditLabel, align: "right", cell: (l) => (Number(l.credit) ? <Money amount={l.credit} /> : "") },
    {
      key: "balance",
      header: balanceLabel,
      align: "right",
      cell: (l) => <Money amount={l.running_base} className="font-medium" />,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(l) => `${l.entry_id}-${l.account}-${l.debit}-${l.credit}`}
      empty={loading ? <LoadingState /> : <EmptyState icon={ScrollText} title="Hareket yok" />}
    />
  );
}
